import type { Vec2 } from '@dragonballistics/shared';
import type {
  BoundsExitCandidate,
  CircularTarget,
  CollisionCandidate,
  CollisionWorld,
  TerrainSegment,
  WorldBounds,
} from './types';

const EPSILON = 1e-9;

/**
 * Numerical contract for curved-step collision detection.
 *
 * The path is flattened until its quarter/midpoint deviation from the chord is at most 1e-5 world
 * units (or 1e-4 of the smallest target radius), while never accepting a leaf wider than 1/16 of a
 * step. Contacts are then refined in time to 1e-10 of the step. A 1e-7 world-unit floor prevents
 * floating-point noise from causing unbounded subdivision.
 */
export const COLLISION_NUMERICS = {
  minimumPositionTolerance: 1e-7,
  maximumFlatnessTolerance: 1e-5,
  targetRadiusToleranceRatio: 1e-4,
  fractionTolerance: 1e-10,
  maximumLeafFraction: 1 / 16,
  maximumSubdivisionDepth: 16,
} as const;

interface PathSample {
  fraction: number;
  point: Vec2;
}

export interface TrajectoryStepEvent {
  collision: CollisionCandidate | null;
  boundsExit: BoundsExitCandidate | null;
  closestApproach: TrajectoryTargetApproachCandidate | null;
}

export interface TrajectoryTargetApproachCandidate {
  targetId: string;
  fraction: number;
  point: Vec2;
  centerDistance: number;
  surfaceDistance: number;
  spatialTolerance: number;
}

export function findFirstCollision(
  from: Vec2,
  to: Vec2,
  world: CollisionWorld,
): CollisionCandidate | null {
  return collectSegmentCollisionCandidates(from, to, world, 0)[0] ?? null;
}

export function findInitialTerrainCollision(
  position: Vec2,
  velocity: Vec2,
  world: CollisionWorld,
): CollisionCandidate | null {
  const coordinateScale = Math.max(1, Math.abs(position.x), Math.abs(position.y));
  const tolerance = Math.max(
    COLLISION_NUMERICS.minimumPositionTolerance,
    coordinateScale * Number.EPSILON * 64,
  );

  for (
    let terrainSegmentIndex = 0;
    terrainSegmentIndex < world.terrain.length;
    terrainSegmentIndex += 1
  ) {
    const terrain = world.terrain[terrainSegmentIndex];
    if (
      !terrain ||
      Math.abs(signedLineDistance(position, terrain)) > tolerance ||
      !pointProjectsOntoSegment(position, terrain, tolerance)
    ) {
      continue;
    }
    const normal = upwardNormal(terrain);
    const separatingSpeed = velocity.x * normal.x + velocity.y * normal.y;
    if (separatingSpeed > EPSILON) continue;
    return {
      fraction: 0,
      kind: 'terrain',
      point: { ...position },
      normal,
      terrainSegmentIndex,
    };
  }
  return null;
}

/**
 * Finds the first event on the integrated path, rather than on the chord joining the step endpoints.
 * The evaluator must return the position produced by the same integrator used for the simulation.
 */
export function findFirstTrajectoryEvent(
  positionAtFraction: (fraction: number) => Vec2,
  world: CollisionWorld,
  bounds: WorldBounds,
  proximityTargets: readonly CircularTarget[] = [],
): TrajectoryStepEvent {
  const start = positionAtFraction(0);
  const end = positionAtFraction(1);
  const positionTolerance = collisionPositionTolerance(start, end, world, bounds);
  const samples = flattenTrajectory(positionAtFraction, start, end, positionTolerance);
  let closestApproach: TrajectoryTargetApproachCandidate | null = null;

  for (let index = 0; index < samples.length - 1; index += 1) {
    const leafStart = samples[index];
    const leafEnd = samples[index + 1];
    if (!leafStart || !leafEnd) continue;

    const segmentCandidates = collectSegmentCollisionCandidates(
      leafStart.point,
      leafEnd.point,
      world,
      positionTolerance * 2,
    );
    const collision = earliestRefinedCollision(
      segmentCandidates,
      leafStart,
      leafEnd,
      positionAtFraction,
      world,
      positionTolerance,
    );

    const segmentBoundsExit = findBoundsExit(leafStart.point, leafEnd.point, bounds);
    const boundsExit = segmentBoundsExit
      ? refineBoundsExit(leafStart, leafEnd, positionAtFraction, bounds, positionTolerance)
      : null;

    const stoppingFraction = Math.min(
      collision?.fraction ?? 1,
      boundsExit?.fraction ?? 1,
      leafEnd.fraction,
    );
    if (proximityTargets.length > 0 && stoppingFraction >= leafStart.fraction) {
      const stoppingPoint =
        Math.abs(stoppingFraction - leafEnd.fraction) <= EPSILON
          ? leafEnd.point
          : positionAtFraction(stoppingFraction);
      closestApproach = nearerApproach(
        closestApproach,
        closestTargetApproachOnSegment(
          leafStart,
          { fraction: stoppingFraction, point: stoppingPoint },
          proximityTargets,
          positionTolerance,
        ),
      );
      if (collision?.kind === 'target') {
        const contactTarget = proximityTargets.find((target) => target.id === collision.targetId);
        if (contactTarget) {
          closestApproach = nearerApproach(closestApproach, {
            targetId: contactTarget.id,
            fraction: collision.fraction,
            point: { ...collision.point },
            centerDistance: contactTarget.radius,
            surfaceDistance: 0,
            spatialTolerance: positionTolerance,
          });
        }
      }
    }

    if (collision || boundsExit) return { collision, boundsExit, closestApproach };
  }

  return { collision: null, boundsExit: null, closestApproach };
}

function closestTargetApproachOnSegment(
  start: PathSample,
  end: PathSample,
  targets: readonly CircularTarget[],
  spatialTolerance: number,
): TrajectoryTargetApproachCandidate | null {
  const deltaX = end.point.x - start.point.x;
  const deltaY = end.point.y - start.point.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  let closest: TrajectoryTargetApproachCandidate | null = null;

  for (const target of targets) {
    const segmentFraction =
      lengthSquared <= EPSILON
        ? 0
        : clampFraction(
            ((target.center.x - start.point.x) * deltaX +
              (target.center.y - start.point.y) * deltaY) /
              lengthSquared,
          );
    const point = interpolatePoint(start.point, end.point, segmentFraction);
    const centerDistance = pointDistance(point, target.center);
    const candidate: TrajectoryTargetApproachCandidate = {
      targetId: target.id,
      fraction: start.fraction + (end.fraction - start.fraction) * segmentFraction,
      point,
      centerDistance,
      surfaceDistance: Math.max(0, centerDistance - target.radius),
      spatialTolerance,
    };
    closest = nearerApproach(closest, candidate);
  }
  return closest;
}

function nearerApproach(
  left: TrajectoryTargetApproachCandidate | null,
  right: TrajectoryTargetApproachCandidate | null,
): TrajectoryTargetApproachCandidate | null {
  if (!left) return right;
  if (!right) return left;
  if (Math.abs(left.surfaceDistance - right.surfaceDistance) > EPSILON) {
    return right.surfaceDistance < left.surfaceDistance ? right : left;
  }
  if (Math.abs(left.centerDistance - right.centerDistance) > EPSILON) {
    return right.centerDistance < left.centerDistance ? right : left;
  }
  if (Math.abs(left.fraction - right.fraction) > EPSILON) {
    return right.fraction < left.fraction ? right : left;
  }
  return right.targetId < left.targetId ? right : left;
}

export function findBoundsExit(
  from: Vec2,
  to: Vec2,
  bounds: WorldBounds,
): BoundsExitCandidate | null {
  if (pointInsideBounds(to, bounds)) return null;
  if (!pointInsideBounds(from, bounds)) return { fraction: 0, point: from };

  const fractions: number[] = [];
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (to.x < bounds.minimumX && deltaX !== 0) {
    fractions.push((bounds.minimumX - from.x) / deltaX);
  }
  if (to.x > bounds.maximumX && deltaX !== 0) {
    fractions.push((bounds.maximumX - from.x) / deltaX);
  }
  if (to.y < bounds.minimumY && deltaY !== 0) {
    fractions.push((bounds.minimumY - from.y) / deltaY);
  }
  if (to.y > bounds.maximumY && deltaY !== 0) {
    fractions.push((bounds.maximumY - from.y) / deltaY);
  }

  const validFractions = fractions
    .filter((fraction) => fraction >= -EPSILON && fraction <= 1 + EPSILON)
    .map(clampFraction)
    .sort((left, right) => left - right);
  const fraction = validFractions[0];
  return fraction === undefined ? null : { fraction, point: interpolatePoint(from, to, fraction) };
}

export function interpolatePoint(from: Vec2, to: Vec2, fraction: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}

function collectSegmentCollisionCandidates(
  from: Vec2,
  to: Vec2,
  world: CollisionWorld,
  targetPadding: number,
): CollisionCandidate[] {
  const candidates: CollisionCandidate[] = [];

  for (const target of world.targets) {
    const fraction = lineCircleIntersectionFraction(
      from,
      to,
      target.center,
      target.radius + targetPadding,
    );
    if (fraction === null) continue;
    const point = interpolatePoint(from, to, fraction);
    candidates.push({
      fraction,
      kind: 'target',
      point,
      normal: normalize({ x: point.x - target.center.x, y: point.y - target.center.y }),
      targetId: target.id,
    });
  }

  if (world.groundY !== undefined) {
    const verticalDelta = to.y - from.y;
    if (verticalDelta < 0 && from.y >= world.groundY - EPSILON && to.y <= world.groundY) {
      const fraction = clampFraction((world.groundY - from.y) / verticalDelta);
      candidates.push({
        fraction,
        kind: 'ground',
        point: interpolatePoint(from, to, fraction),
        normal: { x: 0, y: 1 },
      });
    }
  }

  world.terrain.forEach((segment, terrainSegmentIndex) => {
    const fraction = segmentIntersectionFraction(from, to, segment);
    // Starting exactly on a surface while moving away must not end a launch.
    if (fraction === null || fraction <= EPSILON) return;
    const point = interpolatePoint(from, to, fraction);
    candidates.push({
      fraction,
      kind: 'terrain',
      point,
      normal: upwardNormal(segment),
      terrainSegmentIndex,
    });
  });

  candidates.sort(compareCandidates);
  return candidates;
}

function flattenTrajectory(
  positionAtFraction: (fraction: number) => Vec2,
  start: Vec2,
  end: Vec2,
  tolerance: number,
): PathSample[] {
  const samples: PathSample[] = [{ fraction: 0, point: start }];
  flattenInterval(
    { fraction: 0, point: start },
    { fraction: 1, point: end },
    0,
    positionAtFraction,
    tolerance,
    samples,
  );
  return samples;
}

function flattenInterval(
  start: PathSample,
  end: PathSample,
  depth: number,
  positionAtFraction: (fraction: number) => Vec2,
  tolerance: number,
  output: PathSample[],
) {
  const span = end.fraction - start.fraction;
  const quarterFraction = start.fraction + span * 0.25;
  const middleFraction = start.fraction + span * 0.5;
  const threeQuarterFraction = start.fraction + span * 0.75;
  const quarter = positionAtFraction(quarterFraction);
  const middle = positionAtFraction(middleFraction);
  const threeQuarter = positionAtFraction(threeQuarterFraction);
  const flatness = Math.max(
    pointDistance(quarter, interpolatePoint(start.point, end.point, 0.25)),
    pointDistance(middle, interpolatePoint(start.point, end.point, 0.5)),
    pointDistance(threeQuarter, interpolatePoint(start.point, end.point, 0.75)),
  );
  const mustSplit =
    depth < COLLISION_NUMERICS.maximumSubdivisionDepth &&
    (span > COLLISION_NUMERICS.maximumLeafFraction || flatness > tolerance);

  if (mustSplit) {
    const middleSample = { fraction: middleFraction, point: middle };
    flattenInterval(start, middleSample, depth + 1, positionAtFraction, tolerance, output);
    flattenInterval(middleSample, end, depth + 1, positionAtFraction, tolerance, output);
    return;
  }

  output.push(end);
}

function earliestRefinedCollision(
  candidates: CollisionCandidate[],
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  world: CollisionWorld,
  tolerance: number,
): CollisionCandidate | null {
  const refined = candidates
    .map((candidate) =>
      refineCollisionCandidate(candidate, leafStart, leafEnd, positionAtFraction, world, tolerance),
    )
    .filter((candidate): candidate is CollisionCandidate => candidate !== null)
    .sort(compareCandidates);
  return refined[0] ?? null;
}

function refineCollisionCandidate(
  candidate: CollisionCandidate,
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  world: CollisionWorld,
  tolerance: number,
): CollisionCandidate | null {
  if (candidate.kind === 'target') {
    const target = world.targets.find((item) => item.id === candidate.targetId);
    return target
      ? refineTargetContact(leafStart, leafEnd, positionAtFraction, target, tolerance)
      : null;
  }
  if (candidate.kind === 'ground') {
    return world.groundY === undefined
      ? null
      : refineGroundContact(leafStart, leafEnd, positionAtFraction, world.groundY, tolerance);
  }
  const terrainIndex = candidate.terrainSegmentIndex;
  const terrain = terrainIndex === undefined ? undefined : world.terrain[terrainIndex];
  return terrain && terrainIndex !== undefined
    ? refineTerrainContact(leafStart, leafEnd, positionAtFraction, terrain, terrainIndex, tolerance)
    : null;
}

function refineTargetContact(
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  target: CircularTarget,
  tolerance: number,
): CollisionCandidate | null {
  const signedDistance = (fraction: number) =>
    pointDistance(positionAtFraction(fraction), target.center) - target.radius;
  const startDistance = signedDistance(leafStart.fraction);
  if (startDistance <= tolerance) {
    return targetCandidateAt(leafStart.fraction, positionAtFraction, target);
  }

  const closestFraction = minimizeScalar(leafStart.fraction, leafEnd.fraction, (fraction) =>
    pointDistanceSquared(positionAtFraction(fraction), target.center),
  );
  const closestDistance = signedDistance(closestFraction);
  if (closestDistance > tolerance) return null;

  const contactFraction =
    closestDistance <= 0
      ? bisectFirstContact(
          leafStart.fraction,
          closestFraction,
          signedDistance,
          COLLISION_NUMERICS.fractionTolerance,
        )
      : closestFraction;
  return targetCandidateAt(contactFraction, positionAtFraction, target);
}

function targetCandidateAt(
  fraction: number,
  positionAtFraction: (fraction: number) => Vec2,
  target: CircularTarget,
): CollisionCandidate {
  const point = positionAtFraction(fraction);
  return {
    fraction,
    kind: 'target',
    point,
    normal: normalize({ x: point.x - target.center.x, y: point.y - target.center.y }),
    targetId: target.id,
  };
}

function refineGroundContact(
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  groundY: number,
  tolerance: number,
): CollisionCandidate | null {
  const height = (fraction: number) => positionAtFraction(fraction).y - groundY;
  if (height(leafStart.fraction) < -tolerance || height(leafEnd.fraction) > tolerance) return null;
  const fraction = bisectFirstContact(
    leafStart.fraction,
    leafEnd.fraction,
    height,
    COLLISION_NUMERICS.fractionTolerance,
  );
  const pathPoint = positionAtFraction(fraction);
  return {
    fraction,
    kind: 'ground',
    point: { x: pathPoint.x, y: groundY },
    normal: { x: 0, y: 1 },
  };
}

function refineTerrainContact(
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  terrain: TerrainSegment,
  terrainSegmentIndex: number,
  tolerance: number,
): CollisionCandidate | null {
  const signedDistance = (fraction: number) =>
    signedLineDistance(positionAtFraction(fraction), terrain);
  const startDistance = signedDistance(leafStart.fraction);
  const endDistance = signedDistance(leafEnd.fraction);
  let fraction: number;

  if (startDistance === 0 || startDistance * endDistance <= 0) {
    fraction = bisectSignChange(
      leafStart.fraction,
      leafEnd.fraction,
      signedDistance,
      COLLISION_NUMERICS.fractionTolerance,
    );
  } else {
    fraction = minimizeScalar(leafStart.fraction, leafEnd.fraction, (value) =>
      Math.abs(signedDistance(value)),
    );
    if (Math.abs(signedDistance(fraction)) > tolerance) return null;
  }

  const point = positionAtFraction(fraction);
  if (!pointProjectsOntoSegment(point, terrain, tolerance)) return null;
  return {
    fraction,
    kind: 'terrain',
    point,
    normal: upwardNormal(terrain),
    terrainSegmentIndex,
  };
}

function refineBoundsExit(
  leafStart: PathSample,
  leafEnd: PathSample,
  positionAtFraction: (fraction: number) => Vec2,
  bounds: WorldBounds,
  tolerance: number,
): BoundsExitCandidate | null {
  const margin = (fraction: number) => insideMargin(positionAtFraction(fraction), bounds);
  if (margin(leafStart.fraction) < -tolerance) {
    return { fraction: leafStart.fraction, point: positionAtFraction(leafStart.fraction) };
  }
  if (margin(leafEnd.fraction) > tolerance) return null;
  const fraction = bisectFirstContact(
    leafStart.fraction,
    leafEnd.fraction,
    margin,
    COLLISION_NUMERICS.fractionTolerance,
  );
  return { fraction, point: clampPointToBounds(positionAtFraction(fraction), bounds) };
}

function bisectFirstContact(
  start: number,
  end: number,
  signedDistance: (fraction: number) => number,
  fractionTolerance: number,
): number {
  let outside = start;
  let contact = end;
  if (signedDistance(outside) <= 0) return outside;
  for (let iteration = 0; iteration < 64 && contact - outside > fractionTolerance; iteration += 1) {
    const middle = (outside + contact) * 0.5;
    if (signedDistance(middle) <= 0) contact = middle;
    else outside = middle;
  }
  return contact;
}

function bisectSignChange(
  start: number,
  end: number,
  valueAt: (fraction: number) => number,
  fractionTolerance: number,
): number {
  let left = start;
  let right = end;
  let leftValue = valueAt(left);
  if (Math.abs(leftValue) <= EPSILON) return left;
  for (let iteration = 0; iteration < 64 && right - left > fractionTolerance; iteration += 1) {
    const middle = (left + right) * 0.5;
    const middleValue = valueAt(middle);
    if (Math.abs(middleValue) <= EPSILON) return middle;
    if (leftValue * middleValue <= 0) right = middle;
    else {
      left = middle;
      leftValue = middleValue;
    }
  }
  return (left + right) * 0.5;
}

function minimizeScalar(start: number, end: number, valueAt: (fraction: number) => number): number {
  const inverseGoldenRatio = (Math.sqrt(5) - 1) / 2;
  let left = start;
  let right = end;
  let first = right - (right - left) * inverseGoldenRatio;
  let second = left + (right - left) * inverseGoldenRatio;
  let firstValue = valueAt(first);
  let secondValue = valueAt(second);

  for (
    let iteration = 0;
    iteration < 64 && right - left > COLLISION_NUMERICS.fractionTolerance;
    iteration += 1
  ) {
    if (firstValue <= secondValue) {
      right = second;
      second = first;
      secondValue = firstValue;
      first = right - (right - left) * inverseGoldenRatio;
      firstValue = valueAt(first);
    } else {
      left = first;
      first = second;
      firstValue = secondValue;
      second = left + (right - left) * inverseGoldenRatio;
      secondValue = valueAt(second);
    }
  }
  return firstValue <= secondValue ? first : second;
}

function lineCircleIntersectionFraction(
  from: Vec2,
  to: Vec2,
  center: Vec2,
  radius: number,
): number | null {
  const offset = { x: from.x - center.x, y: from.y - center.y };
  const radiusSquared = radius * radius;
  if (offset.x * offset.x + offset.y * offset.y <= radiusSquared) return 0;

  const delta = { x: to.x - from.x, y: to.y - from.y };
  const a = delta.x * delta.x + delta.y * delta.y;
  if (a <= EPSILON) return null;
  const b = 2 * (offset.x * delta.x + offset.y * delta.y);
  const c = offset.x * offset.x + offset.y * offset.y - radiusSquared;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const valid = [first, second]
    .filter((fraction) => fraction >= -EPSILON && fraction <= 1 + EPSILON)
    .map(clampFraction)
    .sort((left, right) => left - right);
  return valid[0] ?? null;
}

function segmentIntersectionFraction(from: Vec2, to: Vec2, segment: TerrainSegment): number | null {
  const projectile = { x: to.x - from.x, y: to.y - from.y };
  const terrain = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
  };
  const denominator = cross(projectile, terrain);
  if (Math.abs(denominator) <= EPSILON) return null;

  const offset = { x: segment.start.x - from.x, y: segment.start.y - from.y };
  const projectileFraction = cross(offset, terrain) / denominator;
  const terrainFraction = cross(offset, projectile) / denominator;
  if (
    projectileFraction < -EPSILON ||
    projectileFraction > 1 + EPSILON ||
    terrainFraction < -EPSILON ||
    terrainFraction > 1 + EPSILON
  ) {
    return null;
  }
  return clampFraction(projectileFraction);
}

function collisionPositionTolerance(
  start: Vec2,
  end: Vec2,
  world: CollisionWorld,
  bounds: WorldBounds,
): number {
  const radii = world.targets.map((target) => target.radius).filter((radius) => radius > 0);
  const smallestRadius = radii.length > 0 ? Math.min(...radii) : Number.POSITIVE_INFINITY;
  const featureTolerance = Math.min(
    COLLISION_NUMERICS.maximumFlatnessTolerance,
    smallestRadius * COLLISION_NUMERICS.targetRadiusToleranceRatio,
  );
  const coordinateScale = Math.max(
    1,
    Math.abs(start.x),
    Math.abs(start.y),
    Math.abs(end.x),
    Math.abs(end.y),
    Math.abs(bounds.minimumX),
    Math.abs(bounds.maximumX),
    Math.abs(bounds.minimumY),
    Math.abs(bounds.maximumY),
  );
  const machineTolerance = coordinateScale * Number.EPSILON * 64;
  return Math.max(COLLISION_NUMERICS.minimumPositionTolerance, featureTolerance, machineTolerance);
}

function insideMargin(point: Vec2, bounds: WorldBounds): number {
  return Math.min(
    point.x - bounds.minimumX,
    bounds.maximumX - point.x,
    point.y - bounds.minimumY,
    bounds.maximumY - point.y,
  );
}

function clampPointToBounds(point: Vec2, bounds: WorldBounds): Vec2 {
  const distances = [
    { distance: Math.abs(point.x - bounds.minimumX), point: { x: bounds.minimumX, y: point.y } },
    { distance: Math.abs(point.x - bounds.maximumX), point: { x: bounds.maximumX, y: point.y } },
    { distance: Math.abs(point.y - bounds.minimumY), point: { x: point.x, y: bounds.minimumY } },
    { distance: Math.abs(point.y - bounds.maximumY), point: { x: point.x, y: bounds.maximumY } },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  return distances[0]?.point ?? point;
}

function pointInsideBounds(point: Vec2, bounds: WorldBounds): boolean {
  return (
    point.x >= bounds.minimumX - EPSILON &&
    point.x <= bounds.maximumX + EPSILON &&
    point.y >= bounds.minimumY - EPSILON &&
    point.y <= bounds.maximumY + EPSILON
  );
}

function pointProjectsOntoSegment(
  point: Vec2,
  segment: TerrainSegment,
  tolerance: number,
): boolean {
  const direction = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
  };
  const lengthSquared = direction.x * direction.x + direction.y * direction.y;
  if (lengthSquared <= EPSILON) return false;
  const projection =
    ((point.x - segment.start.x) * direction.x + (point.y - segment.start.y) * direction.y) /
    lengthSquared;
  const fractionTolerance = tolerance / Math.sqrt(lengthSquared);
  return projection >= -fractionTolerance && projection <= 1 + fractionTolerance;
}

function signedLineDistance(point: Vec2, segment: TerrainSegment): number {
  const direction = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
  };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= EPSILON) return Number.POSITIVE_INFINITY;
  return cross({ x: point.x - segment.start.x, y: point.y - segment.start.y }, direction) / length;
}

function upwardNormal(segment: TerrainSegment): Vec2 {
  const direction = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
  };
  let normal = normalize({ x: -direction.y, y: direction.x });
  if (normal.y < 0) normal = { x: -normal.x, y: -normal.y };
  return normal;
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  return length <= EPSILON ? { x: 0, y: 1 } : { x: vector.x / length, y: vector.y / length };
}

function pointDistance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function pointDistanceSquared(left: Vec2, right: Vec2): number {
  const deltaX = left.x - right.x;
  const deltaY = left.y - right.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function cross(left: Vec2, right: Vec2): number {
  return left.x * right.y - left.y * right.x;
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function compareCandidates(left: CollisionCandidate, right: CollisionCandidate): number {
  if (Math.abs(left.fraction - right.fraction) > EPSILON) return left.fraction - right.fraction;
  return collisionPriority(left.kind) - collisionPriority(right.kind);
}

function collisionPriority(kind: CollisionCandidate['kind']): number {
  if (kind === 'target') return 0;
  if (kind === 'terrain') return 1;
  return 2;
}
