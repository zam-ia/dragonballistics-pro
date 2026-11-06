import type {
  ClosestTargetApproach,
  ImpactResult,
  SimulationInput,
  SimulationMessage,
  SimulationTerminationReason,
} from '../types';

export interface SolverRange {
  minimum: number;
  maximum: number;
}

export interface SolverBudgets {
  maximumEvaluations: number;
  maximumWallTimeMs: number;
  coarseFraction: number;
  refinementRounds: number;
}

export interface SolverInput {
  simulation: SimulationInput;
  targetId: string;
  angleRange: SolverRange;
  powerRange: SolverRange;
  requestedSolutions: number;
  budgets?: Partial<SolverBudgets>;
}

export type SolverStatus =
  'succeeded' | 'no-solution' | 'invalid-input' | 'budget-exhausted' | 'cancelled';

export type SolverArc = 'low' | 'high' | 'undetermined';
export type SolverPhase = 'coarse' | 'refinement' | 'complete';
export type SolverStopReason = 'completed' | 'evaluation-limit' | 'time-limit' | 'cancelled';

export interface SolverCandidate {
  angleDegrees: number;
  power: number;
  arc: SolverArc;
  /** True only after a matching target impact is confirmed by simulateProjectile. */
  hit: boolean;
  verifiedWithFullSimulation: boolean;
  /** Surface distance in world units; a non-hit can also have distance zero. */
  score: number;
  missDistance: number;
  closestApproach: ClosestTargetApproach | null;
  impact: ImpactResult | null;
  flightTimeSeconds: number;
  maximumHeight: number;
  terminationReason: SimulationTerminationReason;
}

export interface SolverProgress {
  phase: SolverPhase;
  evaluatedCandidates: number;
  coarseEvaluations: number;
  refinementEvaluations: number;
  verificationEvaluations: number;
  hitCount: number;
  elapsedMilliseconds: number;
}

export interface SolverExecutionOptions {
  /** Monotonic clock, injectable for deterministic deadline tests. */
  now?: () => number;
  /** Polled between expensive evaluations, not in the physics kernel. */
  isCancelled?: () => boolean;
  /** Observational and synchronous; clients must keep it inexpensive. */
  onProgress?: (progress: Readonly<SolverProgress>) => void;
}

export interface SolverResult {
  status: SolverStatus;
  solutions: SolverCandidate[];
  evaluatedCandidates: number;
  coarseEvaluations: number;
  refinementEvaluations: number;
  verificationEvaluations: number;
  hitCount: number;
  elapsedMilliseconds: number;
  coarseMilliseconds: number;
  refinementMilliseconds: number;
  exhaustedBudget: 'evaluations' | 'time' | null;
  stopReason: SolverStopReason;
  messages: SimulationMessage[];
}

export const DEFAULT_SOLVER_BUDGETS: Readonly<SolverBudgets> = {
  maximumEvaluations: 1_024,
  maximumWallTimeMs: 2_000,
  coarseFraction: 0.75,
  refinementRounds: 6,
};

export const SOLVER_HARD_LIMITS = {
  maximumEvaluations: 4_096,
  maximumWallTimeMs: 5_000,
  refinementRounds: 10,
  requestedSolutions: 16,
} as const;
