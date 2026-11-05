import type { Vec2 } from '@dragonballistics/shared';

export interface ViewportTransform {
  origin: Vec2;
  pixelsPerUnit: number;
  heightPixels: number;
}

export function vectorBetween(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

export function euclideanDistance(from: Vec2, to: Vec2): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function horizontalDistance(from: Vec2, to: Vec2): number {
  return Math.abs(to.x - from.x);
}

export function directionDegrees(from: Vec2, to: Vec2): number {
  const delta = vectorBetween(from, to);
  return (Math.atan2(delta.y, delta.x) * 180) / Math.PI;
}

export function worldToScreen(point: Vec2, transform: ViewportTransform): Vec2 {
  return {
    x: transform.origin.x + point.x * transform.pixelsPerUnit,
    y: transform.heightPixels - (transform.origin.y + point.y * transform.pixelsPerUnit),
  };
}

export function screenToWorld(point: Vec2, transform: ViewportTransform): Vec2 {
  return {
    x: (point.x - transform.origin.x) / transform.pixelsPerUnit,
    y: (transform.heightPixels - point.y - transform.origin.y) / transform.pixelsPerUnit,
  };
}
