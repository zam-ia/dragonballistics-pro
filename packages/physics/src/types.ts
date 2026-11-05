import type { Vec2 } from '@dragonballistics/shared';

export type IntegratorKind = 'semi-implicit-euler' | 'rk4';

export interface KinematicState {
  position: Vec2;
  velocity: Vec2;
  elapsedSeconds: number;
}

export type AccelerationField = (state: Readonly<KinematicState>) => Vec2;

export interface LinearPowerModel {
  kind: 'linear';
  baseSpeed: number;
  speedPerPowerUnit: number;
  minimumPower: number;
  maximumPower: number;
}

export type PowerModel = LinearPowerModel;

export type WindModel =
  | { kind: 'none' }
  | {
      kind: 'acceleration';
      magnitude: number;
      directionDegrees: number;
    }
  | {
      kind: 'linear-drag';
      magnitude: number;
      directionDegrees: number;
      dragCoefficientPerSecond: number;
    };

export interface SimulationEnvironment {
  gravity: number;
  additionalAcceleration: Vec2;
  wind: WindModel;
}

export interface WorldBounds {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

export interface TerrainSegment {
  start: Vec2;
  end: Vec2;
}

export interface CircularTarget {
  id: string;
  center: Vec2;
  radius: number;
}

export interface CollisionWorld {
  groundY?: number;
  terrain: TerrainSegment[];
  targets: CircularTarget[];
}

export interface SimulationInput {
  launchPosition: Vec2;
  launchAngleDegrees: number;
  power: number;
  powerModel: PowerModel;
  environment: SimulationEnvironment;
  integrator: IntegratorKind;
  timeStepSeconds: number;
  maximumTimeSeconds: number;
  maximumIterations: number;
  bounds: WorldBounds;
  collisions: CollisionWorld;
}

export interface TrajectoryPoint {
  position: Vec2;
  velocity: Vec2;
  elapsedSeconds: number;
}

export type ImpactKind = 'ground' | 'terrain' | 'target';

export interface ImpactResult {
  kind: ImpactKind;
  point: Vec2;
  elapsedSeconds: number;
  normal: Vec2;
  targetId?: string;
  terrainSegmentIndex?: number;
}

export type SimulationTerminationReason =
  | 'ground-impact'
  | 'terrain-impact'
  | 'target-impact'
  | 'out-of-bounds'
  | 'maximum-time'
  | 'maximum-iterations'
  | 'invalid-numeric-state'
  | 'invalid-input';

export type SimulationStatus = 'completed' | 'stopped' | 'invalid';

export interface SimulationMessage {
  code: string;
  message: string;
}

export interface SimulationParametersUsed {
  input: SimulationInput;
  initialSpeed: number | null;
}

export interface SimulationResult {
  status: SimulationStatus;
  terminationReason: SimulationTerminationReason;
  trajectory: TrajectoryPoint[];
  finalPosition: Vec2;
  impact: ImpactResult | null;
  flightTimeSeconds: number;
  horizontalRange: number;
  maximumHeight: number;
  apexPoint: TrajectoryPoint;
  iterations: number;
  warnings: SimulationMessage[];
  errors: SimulationMessage[];
  parametersUsed: SimulationParametersUsed;
}

export interface CollisionCandidate {
  fraction: number;
  kind: ImpactKind;
  point: Vec2;
  normal: Vec2;
  targetId?: string;
  terrainSegmentIndex?: number;
}

export interface BoundsExitCandidate {
  fraction: number;
  point: Vec2;
}
