import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageMetadata } from './index';

describe('saved-image validation', () => {
  it('accepts a bounded PNG metadata record', () => {
    expect(validateImageMetadata({ name: 'shot.png', size: 1024, type: 'image/png' })).toEqual({
      name: 'shot.png',
      size: 1024,
      type: 'image/png',
    });
  });

  it('rejects unsupported formats and oversized files', () => {
    expect(() =>
      validateImageMetadata({ name: 'shot.svg', size: 1024, type: 'image/svg+xml' }),
    ).toThrow();
    expect(() =>
      validateImageMetadata({ name: 'shot.png', size: MAX_IMAGE_BYTES + 1, type: 'image/png' }),
    ).toThrow();
  });
});
