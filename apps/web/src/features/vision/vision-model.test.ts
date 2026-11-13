import { describe, expect, it } from 'vitest';
import { normalizedRegion, pixelBounds, type VisionRegion } from './vision-model';

describe('Vision normalized regions', () => {
  it('normalizes reversed drag coordinates and clamps out of range points', () => {
    expect(normalizedRegion({ x: 1.4, y: 0.8 }, { x: -0.2, y: 0.2 })).toEqual({
      x: 0,
      y: 0.2,
      width: 1,
      height: 0.6000000000000001,
    });
  });

  it('maps normalized regions to safe pixel bounds', () => {
    const region: VisionRegion = {
      id: 'one',
      label: 'Prueba',
      kind: 'wind',
      x: 0.25,
      y: 0.5,
      width: 0.5,
      height: 0.25,
    };
    expect(pixelBounds(region, 640, 360)).toEqual({
      x: 160,
      y: 180,
      width: 320,
      height: 90,
    });
  });

  it('retains one pixel for zero-size regions', () => {
    const region: VisionRegion = {
      id: 'one',
      label: 'Muestra',
      kind: 'custom',
      x: 1,
      y: 1,
      width: 0,
      height: 0,
    };
    expect(pixelBounds(region, 100, 100)).toEqual({
      x: 99,
      y: 99,
      width: 1,
      height: 1,
    });
  });
});
