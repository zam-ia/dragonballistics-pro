import { describe, expect, it } from 'vitest';
import { calculateObservationError } from './index';

describe('calibration error', () => {
  it('keeps signed axis residuals and an unsigned total', () => {
    expect(calculateObservationError({ x: 10, y: 10 }, { x: 13, y: 6 })).toEqual({
      horizontal: 3,
      vertical: -4,
      total: 5,
    });
  });
});
