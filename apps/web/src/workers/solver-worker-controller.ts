import type { SolverInput, SolverProgress } from '@dragonballistics/physics';
import { parseWorkerResponse } from './solver-protocol';
import type { SolverWorkerRequest } from './solver-protocol';

export type SolverJobState = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';

export interface SolverControllerSnapshot {
  state: SolverJobState;
  jobId: string | null;
  progress: SolverProgress | null;
  result: SolverResult | null;
  error: string | null;
  /** Measured on the UI thread; not a guarantee of when an OS thread has stopped. */
  workerCreationMilliseconds: number | null;
  messageDispatchMilliseconds: number | null;
  firstProgressMilliseconds: number | null;
  totalMilliseconds: number | null;
  cancelCallMilliseconds: number | null;
}

export type SolverSubscriber = (snapshot: Readonly<SolverControllerSnapshot>) => void;

const initialSnapshot: SolverControllerSnapshot = {
  state: 'idle',
  jobId: null,
  progress: null,
  result: null,
  error: null,
  workerCreationMilliseconds: null,
  messageDispatchMilliseconds: null,
  firstProgressMilliseconds: null,
  totalMilliseconds: null,
  cancelCallMilliseconds: null,
};

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./inverse-solver.worker.ts', import.meta.url), {
    type: 'module',
    name: 'dragonballistics-inverse-solver',
  });
}

/**
 * Each search owns a fresh Worker. On cancel or replacement terminate() kills
 * the synchronous search; a queued CANCEL message alone would not interrupt it.
 * All callbacks are checked against both jobId and Worker instance.
 */
export class SolverWorkerController {
  private readonly listeners = new Set<SolverSubscriber>();
  private readonly createWorker: () => Worker;
  private readonly now: () => number;
  private active: { worker: Worker; jobId: string; startedAt: number } | null = null;
  private sequence = 0;
  private disposed = false;
  private snapshot: SolverControllerSnapshot = { ...initialSnapshot };

  constructor(createWorker: () => Worker = defaultWorkerFactory, now: () => number = () => performance.now()) {
    this.createWorker = createWorker;
    this.now = now;
  }

  getSnapshot(): Readonly<SolverControllerSnapshot> {
    return this.snapshot;
  }

  subscribe(listener: SolverSubscriber): () => void {
    if (this.disposed) throw new Error('SolverWorkerController disposed');
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private publish(snapshot: SolverControllerSnapshot): void {
    if (this.disposed) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private release(worker: Worker): void {
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
  }

  private fail(jobId: string, worker: Worker, message: string): void {
    if (this.active?.jobId !== jobId || this.active.worker !== worker) return;
    const elapsed = this.now() - this.active.startedAt;
    this.active = null;
    this.release(worker);
    this.publish({ ...this.snapshot, state: 'error', error: message,
      result: null, totalMilliseconds: elapsed });
  }

  start(input: SolverInput): string {
    if (this.disposed) throw new Error('SolverWorkerController disposed');
    // Replacing A is an explicit cancellation. Neither A's queued callbacks nor
    // its old Worker can update the state of B.
    this.cancel();
    const jobId = 'solver-job-' + ++this.sequence;
    const startedAt = this.now();
    let worker: Worker;
    try {
      worker = this.createWorker();
    } catch (error) {
      this.publish({ ...initialSnapshot, state: 'error', jobId,
        error: error instanceof Error ? error.message : 'No se pudo crear el Worker.',
        workerCreationMilliseconds: this.now() - startedAt });
      return jobId;
    }
    const workerCreationMilliseconds = this.now() - startedAt;
    this.active = { worker, jobId, startedAt };
    const isCurrent = () => this.active?.jobId === jobId && this.active.worker === worker;

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isCurrent()) return;
      const message = parseWorkerResponse(event.data);
      if (!message) {
        this.fail(jobId, worker, 'Respuesta invalida del Worker.');
        return;
      }
      if (message.jobId !== jobId) return;
      if (message.type === 'PROGRESS') {
        const previous = this.snapshot.progress;
        const phases = { coarse: 0, refinement: 1, complete: 2 };
        if (previous && (message.progress.evaluatedCandidates < previous.evaluatedCandidates ||
          phases[message.progress.phase] < phases[previous.phase] ||
          message.progress.hitCount < previous.hitCount)) return;
        this.publish({
          ...this.snapshot,
          progress: message.progress,
          firstProgressMilliseconds: this.snapshot.firstProgressMilliseconds ??
            this.now() - startedAt,
        });
        return;
      }
      if (message.type === 'ERROR') {
        this.fail(jobId, worker, message.code + ': ' + message.message);
        return;
      }
      // A result claiming unverified hits must never reach consumers.
      if (message.result.solutions.some((candidate) =>
        candidate.hit && !candidate.verifiedWithFullSimulation)) {
        this.fail(jobId, worker, 'El Worker devolvio un impacto sin verificacion fisica.');
        return;
      }
      const totalMilliseconds = this.now() - startedAt;
      this.active = null;
      this.release(worker);
      this.publish({ ...this.snapshot, state: 'completed',
        progress: this.snapshot.progress, result: message.result,
        error: null, totalMilliseconds });
    };
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault?.();
      this.fail(jobId, worker, event.message || 'Error inesperado del Worker.');
    };
    worker.onmessageerror = () => {
      this.fail(jobId, worker, 'No se pudo deserializar un mensaje del Worker.');
    };

    this.publish({ ...initialSnapshot, state: 'running', jobId,
      workerCreationMilliseconds });
    try {
      const beforePost = this.now();
      const message: SolverWorkerRequest = { type: 'START', jobId, input };
      worker.postMessage(message);
      if (isCurrent()) {
        this.publish({ ...this.snapshot,
          messageDispatchMilliseconds: this.now() - beforePost });
      }
    } catch (error) {
      this.fail(jobId, worker, error instanceof Error ? error.message : 'No se pudo iniciar el trabajo.');
    }
    return jobId;
  }

  cancel(): boolean {
    if (!this.active || this.disposed) return false;
    const before = this.now();
    const { worker, jobId, startedAt } = this.active;
    this.active = null;
    try {
      worker.postMessage({ type: 'CANCEL', jobId } satisfies SolverWorkerRequest);
    } catch {
      // Termination is authoritative, even if posting CANCEL fails.
    }
    this.release(worker);
    this.publish({ ...this.snapshot, state: 'cancelled',
      result: null, error: null,
      totalMilliseconds: this.now() - startedAt,
      cancelCallMilliseconds: this.now() - before });
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    if (this.active) this.release(this.active.worker);
    this.active = null;
    this.disposed = true;
    this.listeners.clear();
    this.snapshot = { ...initialSnapshot };
  }
}

/** React may use subscribe/getSnapshot with useSyncExternalStore in Phase 3D. */
export function createSolverWorkerController(): SolverWorkerController {
  return new SolverWorkerController();
}
