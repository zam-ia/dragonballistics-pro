import { describe, expect, it } from 'vitest';
import { createDefaultSimulationInput, solveProjectile } from '@dragonballistics/physics';
import type { SolverInput, SolverProgress, SolverResult } from '@dragonballistics/physics';
import { parseWorkerRequest, parseWorkerResponse } from './solver-protocol';
import type { SolverWorkerRequest, SolverWorkerResponse } from './solver-protocol';
import { SolverWorkerController } from './solver-worker-controller';

const input: SolverInput = {
  simulation: createDefaultSimulationInput(),
  targetId: 'workspace-target',
  angleRange: { minimum: 20, maximum: 70 },
  powerRange: { minimum: 60, maximum: 90 },
  requestedSolutions: 2,
  budgets: { maximumEvaluations: 32, maximumWallTimeMs: 2000, coarseFraction: 0.5, refinementRounds: 2 },
};

class FakeWorker {
  messages: SolverWorkerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  postMessage(message: SolverWorkerRequest) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: SolverWorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}

const progress: SolverProgress = {
  phase: 'coarse', evaluatedCandidates: 16, coarseEvaluations: 16,
  refinementEvaluations: 0, verificationEvaluations: 0, hitCount: 0,
  elapsedMilliseconds: 100,
};

function setup() {
  const workers: FakeWorker[] = [];
  const controller = new SolverWorkerController(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { controller, workers };
}

describe('worker protocol guards', () => {
  it('accepts serializable START and CANCEL and rejects malformed payloads', () => {
    expect(parseWorkerRequest({ type: 'START', jobId: 'a', input })?.type).toBe('START');
    expect(parseWorkerRequest({ type: 'CANCEL', jobId: 'a' })).toEqual({ type: 'CANCEL', jobId: 'a' });
    expect(parseWorkerRequest({ type: 'START', jobId: 'a', input: null })).toBeNull();
    expect(parseWorkerRequest({ type: 'START', jobId: '', input })).toBeNull();
    expect(parseWorkerRequest({ type: 'START', jobId: 'a', input: {
      ...input, simulation: { ...input.simulation, collisions: null },
    } })).toBeNull();
    expect(parseWorkerResponse({ type: 'PROGRESS', jobId: 'a', progress: { ...progress, hitCount: -1 } })).toBeNull();
    expect(parseWorkerResponse({ type: 'RESULT', jobId: 'a',
      result: { status: 'succeeded', solutions: [{ hit: true, verifiedWithFullSimulation: false, angleDegrees: 30, power: 40 }],
        evaluatedCandidates: 2, verificationEvaluations: 0, hitCount: 1 } })).toBeNull();
  });
});

describe('solver Worker controller with deterministic simulated Worker', () => {
  it('starts a job, streams progress, accepts valid physics result, and releases the Worker', () => {
    const { controller, workers } = setup();
    const states: string[] = [];
    const unsubscribe = controller.subscribe((snapshot) => states.push(snapshot.state));
    const jobId = controller.start(input);
    expect(workers[0]?.messages[0]).toEqual({ type: 'START', jobId, input });
    workers[0]?.emit({ type: 'PROGRESS', jobId, progress });
    expect(controller.getSnapshot().progress?.evaluatedCandidates).toBe(16);
    const result = solveProjectile(input, { now: () => 0 });
    workers[0]?.emit({ type: 'RESULT', jobId, result });
    expect(controller.getSnapshot().result).toEqual(result);
    expect(controller.getSnapshot().state).toBe('completed');
    expect(workers[0]?.terminated).toBe(true);
    expect(states).toContain('running');
    expect(states).toContain('completed');
    unsubscribe();
    controller.dispose();
  });

  it('cancels an active job and never accepts its late result', () => {
    const { controller, workers } = setup();
    const a = controller.start(input);
    const oldHandler = workers[0]?.onmessage;
    expect(controller.cancel()).toBe(true);
    expect(workers[0]?.terminated).toBe(true);
    expect(workers[0]?.messages[1]).toEqual({ type: 'CANCEL', jobId: a });
    expect(controller.getSnapshot().state).toBe('cancelled');
    expect(controller.getSnapshot().cancelCallMilliseconds).not.toBeNull();
    // An artificial, retained callback from the old worker can never overwrite B.
    const b = controller.start(input);
    oldHandler?.({ data: { type: 'PROGRESS', jobId: a, progress } } as MessageEvent<unknown>);
    workers[1]?.emit({ type: 'PROGRESS', jobId: b, progress });
    expect(controller.getSnapshot().jobId).toBe(b);
    expect(controller.getSnapshot().progress?.coarseEvaluations).toBe(16);
    controller.dispose();
  });

  it('replaces a running search and ignores stale job IDs even from its new Worker', () => {
    const { controller, workers } = setup();
    const a = controller.start(input);
    const b = controller.start(input);
    expect(a).not.toBe(b);
    expect(workers[0]?.terminated).toBe(true);
    workers[1]?.emit({ type: 'PROGRESS', jobId: a, progress });
    expect(controller.getSnapshot().progress).toBeNull();
    workers[1]?.emit({ type: 'PROGRESS', jobId: b, progress });
    workers[1]?.emit({ type: 'PROGRESS', jobId: b, progress: {
      ...progress, evaluatedCandidates: 2,
    } });
    expect(controller.getSnapshot().progress?.evaluatedCandidates).toBe(16);
    controller.dispose();
  });

  it('recovers after Worker errors and runtime protocol errors', () => {
    const { controller, workers } = setup();
    const a = controller.start(input);
    workers[0]?.emit({ type: 'ERROR', jobId: a, code: 'invalid-message', message: 'input malformado' });
    expect(controller.getSnapshot().state).toBe('error');
    expect(workers[0]?.terminated).toBe(true);
    const b = controller.start(input);
    workers[1]?.onerror?.(new ErrorEvent('error', { message: 'crash inesperado' }));
    expect(controller.getSnapshot().state).toBe('error');
    expect(controller.getSnapshot().jobId).toBe(b);
    const c = controller.start(input);
    workers[2]?.emit({ type: 'PROGRESS', jobId: c, progress });
    expect(controller.getSnapshot().state).toBe('running');
    controller.dispose();
  });

  it('handles Worker creation failures, disposal and verified-hit enforcement', () => {
    let fail = true;
    const worker = new FakeWorker();
    const controller = new SolverWorkerController(() => {
      if (fail) throw new Error('Worker unavailable');
      return worker as unknown as Worker;
    });
    controller.start(input);
    expect(controller.getSnapshot().state).toBe('error');
    fail = false;
    const id = controller.start(input);
    const raw = solveProjectile(input, { now: () => 0 });
    const forged: SolverResult = { ...raw, solutions: [{
      ...raw.solutions[0]!, hit: true, verifiedWithFullSimulation: false,
    }] };
    // Deliberately bypass protocol validation and inspect the controller's rejection.
    worker.onmessage?.({ data: { type: 'RESULT', jobId: id, result: forged } } as MessageEvent<unknown>);
    expect(controller.getSnapshot().state).toBe('error');
    expect(worker.terminated).toBe(true);
    controller.dispose();
    expect(() => controller.start(input)).toThrow('disposed');
  });
});
