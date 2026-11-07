import { describe, expect, it } from 'vitest';
import {
  evaluateQuarticBernstein,
  quarticBernsteinControlsFromSamples,
  quarticChordDeviationBoundSquared,
} from './polynomial-path';

const polynomial = (fraction: number) => ({
  x: 2 + 5 * fraction - 3 * fraction ** 2 + 0.5 * fraction ** 4,
  y: 4 - 2 * fraction + 6 * fraction ** 2 - 4 * fraction ** 3 + fraction ** 4,
});

describe('quartic path reconstruction', () => {
  it('reconstructs a degree-four RK4-style position from five samples', () => {
    const controls = quarticBernsteinControlsFromSamples(
      polynomial(0),
      polynomial(0.25),
      polynomial(0.5),
      polynomial(0.75),
      polynomial(1),
    );

    for (let index = 0; index <= 100; index += 1) {
      const fraction = index / 100;
      const actual = evaluateQuarticBernstein(controls, fraction);
      const expected = polynomial(fraction);
      expect(actual.x).toBeCloseTo(expected.x, 12);
      expect(actual.y).toBeCloseTo(expected.y, 12);
    }
  });

  it('uses a conservative convex-hull bound for deviation from the chord', () => {
    const start = polynomial(0);
    const end = polynomial(1);
    const boundSquared = quarticChordDeviationBoundSquared(
      start,
      polynomial(0.25),
      polynomial(0.5),
      polynomial(0.75),
      end,
    );
    let observedMaximumSquared = 0;
    for (let index = 0; index <= 1_000; index += 1) {
      const fraction = index / 1_000;
      const point = polynomial(fraction);
      const chord = {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };
      observedMaximumSquared = Math.max(
        observedMaximumSquared,
        (point.x - chord.x) ** 2 + (point.y - chord.y) ** 2,
      );
    }

    expect(boundSquared).toBeGreaterThanOrEqual(observedMaximumSquared);
  });
});
