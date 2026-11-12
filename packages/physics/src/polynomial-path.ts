import type { Vec2 } from '@dragonballistics/shared';

export type QuarticBernsteinControls = readonly [Vec2, Vec2, Vec2, Vec2, Vec2];

/**
 * Reconstructs a degree-four vector polynomial from samples at 0, 1/4, 1/2, 3/4 and 1.
 */
export function quarticBernsteinControlsFromSamples(
  start: Vec2,
  quarter: Vec2,
  middle: Vec2,
  threeQuarter: Vec2,
  end: Vec2,
): QuarticBernsteinControls {
  const quarterDeviation = subtract(quarter, interpolate(start, end, 0.25));
  const middleDeviation = subtract(middle, interpolate(start, end, 0.5));
  const threeQuarterDeviation = subtract(threeQuarter, interpolate(start, end, 0.75));
  const deviationControls = interiorDeviationControls(
    quarterDeviation,
    middleDeviation,
    threeQuarterDeviation,
  );
  return [
    { ...start },
    add(interpolate(start, end, 0.25), deviationControls[0]),
    add(interpolate(start, end, 0.5), deviationControls[1]),
    add(interpolate(start, end, 0.75), deviationControls[2]),
    { ...end },
  ];
}

export function evaluateQuarticBernstein(
  controls: QuarticBernsteinControls,
  fraction: number,
): Vec2 {
  const complement = 1 - fraction;
  const complementSquared = complement * complement;
  const fractionSquared = fraction * fraction;
  const weight0 = complementSquared * complementSquared;
  const weight1 = 4 * complementSquared * complement * fraction;
  const weight2 = 6 * complementSquared * fractionSquared;
  const weight3 = 4 * complement * fractionSquared * fraction;
  const weight4 = fractionSquared * fractionSquared;
  return {
    x:
      controls[0].x * weight0 +
      controls[1].x * weight1 +
      controls[2].x * weight2 +
      controls[3].x * weight3 +
      controls[4].x * weight4,
    y:
      controls[0].y * weight0 +
      controls[1].y * weight1 +
      controls[2].y * weight2 +
      controls[3].y * weight3 +
      controls[4].y * weight4,
  };
}

/** Conservatively bounds distance from the endpoint chord through the Bezier convex hull. */
export function quarticChordDeviationBoundSquared(
  start: Vec2,
  quarter: Vec2,
  middle: Vec2,
  threeQuarter: Vec2,
  end: Vec2,
): number {
  const controls = quarticBernsteinControlsFromSamples(start, quarter, middle, threeQuarter, end);
  let maximum = 0;
  for (let index = 1; index <= 3; index += 1) {
    const control = controls[index];
    if (!control) continue;
    const chord = interpolate(start, end, index / 4);
    const deltaX = control.x - chord.x;
    const deltaY = control.y - chord.y;
    maximum = Math.max(maximum, deltaX * deltaX + deltaY * deltaY);
  }
  return maximum;
}

function interiorDeviationControls(
  quarter: Vec2,
  middle: Vec2,
  threeQuarter: Vec2,
): readonly [Vec2, Vec2, Vec2] {
  const aX = (32 / 3) * quarter.x - 6 * middle.x;
  const aY = (32 / 3) * quarter.y - 6 * middle.y;
  const cX = (32 / 3) * threeQuarter.x - 6 * middle.x;
  const cY = (32 / 3) * threeQuarter.y - 6 * middle.y;
  return [
    { x: (cX + 3 * aX) / 8, y: (cY + 3 * aY) / 8 },
    { x: (8 * middle.x - aX - cX) / 3, y: (8 * middle.y - aY - cY) / 3 },
    { x: (3 * cX + aX) / 8, y: (3 * cY + aY) / 8 },
  ];
}

function interpolate(start: Vec2, end: Vec2, fraction: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y };
}
