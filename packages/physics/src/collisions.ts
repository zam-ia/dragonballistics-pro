import type { Vec2 } from '@dragonballistics/shared';
import type {
  BoundsExitCandidate,
  CollisionCandidate,
  CollisionWorld,
  TerrainSegment,
  WorldBounds,
} from './types';

const EPSILON = 1e-9;

export function findFirstCollision(
  from: Vec2,
  to: Vec2,
  world: CollisionWorld,
): CollisionCandidate | null {
  const candidates: CollisionCandidate[] = [];

  for (const target of world.targets) {
    const fraction = lineCircleIntersectionFraction(from, to, target.center, target.radius);
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

  candidates.sort((left, right) => {
    if (Math.abs(left.fraction - right.fraction) > EPSILON) {
      return left.fraction - right.fraction;
    }
    return collisionPriority(left.kind) - collisionPriority(right.kind);
  });
  return candidates[0] ?? null;
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

function pointInsideBounds(point: Vec2, bounds: WorldBounds): boolean {
  return (
    point.x >= bounds.minimumX - EPSILON &&
    point.x <= bounds.maximumX + EPSILON &&
    point.y >= bounds.minimumY - EPSILON &&
    point.y <= bounds.maximumY + EPSILON
  );
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

function cross(left: Vec2, right: Vec2): number {
  return left.x * right.y - left.y * right.x;
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function collisionPriority(kind: CollisionCandidate['kind']): number {
  if (kind === 'target') return 0;
  if (kind === 'terrain') return 1;
  return 2;
}
