import { z } from 'zod';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const acceptedImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const ImageMetadataSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
  type: z.enum(acceptedImageMimeTypes),
});

export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

export function validateImageMetadata(input: unknown): ImageMetadata {
  return ImageMetadataSchema.parse(input);
}
