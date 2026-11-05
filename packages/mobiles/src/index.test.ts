import { describe, expect, it } from 'vitest';
import { MobileProfileSchema, mobileRegistry } from './index';

describe('mobile profile provenance', () => {
  it('starts empty instead of inventing game constants', () => {
    expect(mobileRegistry).toEqual([]);
  });

  it('requires an explicit source label', () => {
    const result = MobileProfileSchema.safeParse({
      id: 'example',
      name: 'Example',
      description: 'Test fixture',
      status: 'provisional',
      version: '0.0.1',
      source: { label: '' },
      shots: [],
    });

    expect(result.success).toBe(false);
  });
});
