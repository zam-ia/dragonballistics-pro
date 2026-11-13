import { pixelBounds, type VisionFrameRequest, type VisionFrameResult } from './vision-model';

interface VisionScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: VisionFrameResult) => void;
}

const scope = self as unknown as VisionScope;
let activeSession = -1;
const earlierSamples = new Map<string, number[]>();

scope.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data as VisionFrameRequest;
  if (
    !request ||
    request.type !== 'FRAME' ||
    !Number.isInteger(request.sessionId) ||
    !Number.isInteger(request.frameId) ||
    !Number.isInteger(request.width) ||
    !Number.isInteger(request.height) ||
    request.width < 1 ||
    request.height < 1 ||
    request.width > 4096 ||
    request.height > 4096 ||
    !(request.pixels instanceof Uint8ClampedArray) ||
    request.pixels.length !== request.width * request.height * 4 ||
    !Array.isArray(request.regions) ||
    request.regions.length > 24
  ) {
    return;
  }

  if (activeSession !== request.sessionId) {
    activeSession = request.sessionId;
    earlierSamples.clear();
  }

  const began = performance.now();
  const { pixels, width, height } = request;
  const regions = request.regions.map((region) => {
    const bounds = pixelBounds(region, width, height);
    const step = Math.max(1, Math.floor(Math.sqrt((bounds.width * bounds.height) / 800)));
    const current: number[] = [];
    let brightness = 0;
    let edges = 0;
    let count = 0;

    for (let y = bounds.y; y < bounds.y + bounds.height; y += step) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += step) {
        const index = (y * width + x) * 4;
        const luminance =
          (pixels[index]! * 0.2126 +
            pixels[index + 1]! * 0.7152 +
            pixels[index + 2]! * 0.0722) /
          255;
        const neighborX = Math.min(width - 1, x + step);
        const neighborIndex = (y * width + neighborX) * 4;
        const nextLuminance =
          (pixels[neighborIndex]! * 0.2126 +
            pixels[neighborIndex + 1]! * 0.7152 +
            pixels[neighborIndex + 2]! * 0.0722) /
          255;
        brightness += luminance;
        edges += Math.abs(luminance - nextLuminance);
        current.push(luminance);
        count += 1;
      }
    }

    const previous = earlierSamples.get(region.id);
    let motionActivity: number | null = null;
    if (previous && previous.length === current.length && count > 0) {
      let changes = 0;
      for (let i = 0; i < count; i += 1) {
        if (Math.abs(current[i]! - previous[i]!) > 0.085) changes += 1;
      }
      motionActivity = changes / count;
    }
    earlierSamples.set(region.id, current);

    return {
      regionId: region.id,
      meanBrightness: count ? brightness / count : 0,
      edgeActivity: count ? edges / count : 0,
      motionActivity,
      samples: count,
    };
  });

  scope.postMessage({
    type: 'FRAME_RESULT',
    sessionId: request.sessionId,
    frameId: request.frameId,
    elapsedMs: performance.now() - began,
    regions,
  });
};
