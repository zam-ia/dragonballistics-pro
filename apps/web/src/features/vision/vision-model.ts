export type VisionKind = 'wind' | 'vehicles' | 'terrain' | 'effects' | 'custom';

export interface VisionRegion {
  id: string;
  kind: VisionKind;
  label: string;
  /** Normalized coordinates in the source frame, from 0 to 1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionMetrics {
  regionId: string;
  meanBrightness: number;
  edgeActivity: number;
  motionActivity: number | null;
  samples: number;
}

export interface VisionFrameRequest {
  type: 'FRAME';
  sessionId: number;
  frameId: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  regions: VisionRegion[];
}

export interface VisionFrameResult {
  type: 'FRAME_RESULT';
  sessionId: number;
  frameId: number;
  elapsedMs: number;
  regions: VisionMetrics[];
}

export const VISION_KINDS: ReadonlyArray<{ value: VisionKind; label: string }> = [
  { value: 'wind', label: 'Indicador de viento' },
  { value: 'vehicles', label: 'Móviles visibles' },
  { value: 'terrain', label: 'Terreno' },
  { value: 'effects', label: 'Remolinos / efectos' },
  { value: 'custom', label: 'Otra región' },
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizedRegion(
  first: { x: number; y: number },
  last: { x: number; y: number },
): Pick<VisionRegion, 'x' | 'y' | 'width' | 'height'> {
  const ax = clamp01(first.x);
  const ay = clamp01(first.y);
  const bx = clamp01(last.x);
  const by = clamp01(last.y);
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export function pixelBounds(region: VisionRegion, width: number, height: number) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(region.x * width)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(region.y * height)));
  const right = Math.max(x + 1, Math.min(width, Math.ceil((region.x + region.width) * width)));
  const bottom = Math.max(y + 1, Math.min(height, Math.ceil((region.y + region.height) * height)));
  return { x, y, width: right - x, height: bottom - y };
}
