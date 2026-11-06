import { solveProjectile } from '@dragonballistics/physics';
import type { SolverProgress } from '@dragonballistics/physics';
import { parseWorkerRequest } from './solver-protocol';
import type { SolverWorkerResponse } from './solver-protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: SolverWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;
let activeJobId: string | null = null;
let cancelled = false;

function send(message: SolverWorkerResponse) {
  scope.postMessage(message);
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const request = parseWorkerRequest(event.data);
  if (!request) {
    const raw = event.data;
    const jobId = raw && typeof raw === 'object' && 'jobId' in raw &&
      typeof raw.jobId === 'string' ? raw.jobId : 'invalid-job';
    send({ type: 'ERROR', jobId, code: 'invalid-message',
      message: 'El mensaje no cumple el contrato serializable del Worker.' });
    return;
  }
  if (request.type === 'CANCEL') {
    if (request.jobId === activeJobId) cancelled = true;
    return;
  }
  if (activeJobId !== null) {
    send({ type: 'ERROR', jobId: request.jobId, code: 'worker-busy',
      message: 'El Worker ya ejecuta otro trabajo.' });
    return;
  }

  activeJobId = request.jobId;
  cancelled = false;
  let lastSentAt = performance.now();
  let lastCount = -16;
  let lastPhase: SolverProgress['phase'] | null = null;
  try {
    const result = solveProjectile(request.input, {
      isCancelled: () => cancelled,
      onProgress: (progress) => {
        const now = performance.now();
        if (progress.phase !== lastPhase ||
            progress.evaluatedCandidates - lastCount >= 16 ||
            now - lastSentAt >= 50) {
          lastSentAt = now;
          lastCount = progress.evaluatedCandidates;
          lastPhase = progress.phase;
          send({ type: 'PROGRESS', jobId: request.jobId, progress });
        }
      },
    });
    if (!cancelled) send({ type: 'RESULT', jobId: request.jobId, result });
  } catch (error) {
    send({
      type: 'ERROR',
      jobId: request.jobId,
      code: 'worker-execution-failed',
      message: error instanceof Error ? error.message : 'Error desconocido en el solucionador.',
    });
  } finally {
    activeJobId = null;
    cancelled = false;
  }
};

// A synchronous solve cannot receive a queued CANCEL while its message handler runs.
// The controller therefore terminates the dedicated Worker for real cancellation.
// This onmessage handler remains for protocol completeness and future cooperative batches.
