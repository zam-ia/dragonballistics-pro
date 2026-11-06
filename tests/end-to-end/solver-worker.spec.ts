import { expect, test } from '@playwright/test';
import type { SolverInput } from '../../packages/physics/src/solver';
import type { SolverWorkerController } from '../../apps/web/src/workers/solver-worker-controller';

declare global {
  interface Window {
    __solverWorkerHarness?: {
      create: () => SolverWorkerController;
      makeInput: (highResolution?: boolean) => SolverInput;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/solver-worker-harness.html');
  await page.waitForFunction(() => Boolean(window.__solverWorkerHarness));
});

test('real bundled Worker returns verified physics results without blocking the page', async ({ page }) => {
  const metrics = await page.evaluate(async () => {
    const harness = window.__solverWorkerHarness!;
    const controller = harness.create();
    let ticks = 0;
    const timer = setInterval(() => ticks++, 5);
    const progress: number[] = [];
    const completed = new Promise<{
      state: string;
      status: string | null;
      verifiedHits: number;
      progress: number[];
      workerCreationMs: number | null;
      firstProgressMs: number | null;
      sendMs: number | null;
      totalMs: number | null;
    }>((resolve, reject) => {
      controller.subscribe((snapshot) => {
        if (snapshot.progress) progress.push(snapshot.progress.evaluatedCandidates);
        if (snapshot.state === 'error') reject(new Error(snapshot.error ?? 'Worker failed'));
        if (snapshot.state === 'completed') {
          resolve({
            state: snapshot.state,
            status: snapshot.result?.status ?? null,
            verifiedHits: snapshot.result?.solutions.filter((c) => c.hit && c.verifiedWithFullSimulation).length ?? 0,
            progress,
            workerCreationMs: snapshot.workerCreationMilliseconds,
            firstProgressMs: snapshot.firstProgressMilliseconds,
            sendMs: snapshot.messageDispatchMilliseconds,
            totalMs: snapshot.totalMilliseconds,
          });
        }
      });
    });
    controller.start(harness.makeInput());
    const result = await completed;
    clearInterval(timer);
    controller.dispose();
    return { ...result, mainThreadTimerTicks: ticks };
  });
  console.log('WORKER_REAL_RESULT_METRICS ' + JSON.stringify(metrics));
  expect(metrics.state).toBe('completed');
  expect(metrics.status).toBe('succeeded');
  expect(metrics.verifiedHits).toBeGreaterThan(0);
  expect(metrics.progress.length).toBeGreaterThan(0);
  expect(metrics.progress).toEqual([...metrics.progress].sort((a, b) => a - b));
  expect(metrics.workerCreationMs).toBeGreaterThanOrEqual(0);
  expect(metrics.firstProgressMs).toBeGreaterThanOrEqual(0);
  expect(metrics.totalMs).toBeGreaterThan(0);
  expect(metrics.mainThreadTimerTicks).toBeGreaterThan(1);
});

test('real Worker can be forcibly cancelled during high-resolution coarse search and replaced', async ({ page }) => {
  const metrics = await page.evaluate(async () => {
    const harness = window.__solverWorkerHarness!;
    const controller = harness.create();
    let ticks = 0;
    const timer = setInterval(() => ticks++, 5);
    let firstJob = '';
    let secondJob = '';
    let cancelledAt = -1;
    let restartCost = -1;
    const final = new Promise<{
      status: string;
      verifiedHits: number;
      jobId: string | null;
      cancelCallMs: number | null;
      restartMs: number;
      mainThreadTimerTicks: number;
    }>((resolve, reject) => {
      controller.subscribe((snapshot) => {
        if (snapshot.state === 'running' && snapshot.jobId === firstJob &&
            snapshot.progress?.phase === 'coarse' &&
            snapshot.progress.evaluatedCandidates >= 16 && secondJob === '') {
          const before = performance.now();
          const cancelled = controller.cancel();
          cancelledAt = controller.getSnapshot().cancelCallMilliseconds ?? -1;
          if (!cancelled) { reject(new Error('Cancellation rejected')); return; }
          secondJob = controller.start(harness.makeInput());
          restartCost = performance.now() - before;
        }
        if (snapshot.state === 'error') reject(new Error(snapshot.error ?? 'Worker failed'));
        if (snapshot.state === 'completed' && snapshot.jobId === secondJob) {
          resolve({
            status: snapshot.result?.status ?? 'missing',
            verifiedHits: snapshot.result?.solutions.filter((c) => c.hit && c.verifiedWithFullSimulation).length ?? 0,
            jobId: snapshot.jobId,
            cancelCallMs: cancelledAt,
            restartMs: restartCost,
            mainThreadTimerTicks: ticks,
          });
        }
      });
    });
    firstJob = controller.start(harness.makeInput(true));
    const metrics = await final;
    clearInterval(timer);
    controller.dispose();
    return metrics;
  });
  console.log('WORKER_REAL_CANCEL_METRICS ' + JSON.stringify(metrics));
  expect(metrics.status).toBe('succeeded');
  expect(metrics.verifiedHits).toBeGreaterThan(0);
  expect(metrics.cancelCallMs).toBeGreaterThanOrEqual(0);
  expect(metrics.restartMs).toBeGreaterThanOrEqual(0);
  expect(metrics.mainThreadTimerTicks).toBeGreaterThan(1);
});

test('real Worker rejects malformed runtime input and recovers on a fresh job', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const harness = window.__solverWorkerHarness!;
    const controller = harness.create();
    const states: string[] = [];
    const wait = (expected: string) => new Promise<void>((resolve) => {
      const unsubscribe = controller.subscribe((snapshot) => {
        if (snapshot.state === expected) {
          unsubscribe();
          resolve();
        }
      });
    });
    const malformed = harness.makeInput();
    (malformed.simulation.collisions as unknown as { targets: unknown }).targets = null;
    const failure = wait('error');
    controller.start(malformed);
    await failure;
    states.push(controller.getSnapshot().state);
    const recovery = wait('completed');
    controller.start(harness.makeInput());
    await recovery;
    states.push(controller.getSnapshot().state);
    const status = controller.getSnapshot().result?.status;
    controller.dispose();
    return { states, status };
  });
  expect(result.states).toEqual(['error', 'completed']);
  expect(result.status).toBe('succeeded');
});
