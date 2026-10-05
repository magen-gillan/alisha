'use client';

/**
 * Pollinations image generation client.
 *
 * Pollinations exposes a simple GET endpoint for image generation:
 *   https://image.pollinations.ai/prompt/{ENCODED_PROMPT}
 *
 * The endpoint returns a PNG/JPEG directly (no JSON), so we just append
 * the URL to an <img> tag.
 *
 * Optional query params:
 *   - width / height (default 1024x1024)
 *   - model (default 'flux')
 *   - seed (for reproducibility)
 *   - nologo (true hides the watermark)
 */

export interface GenerateImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  seed?: number;
  nologo?: boolean;
}

/**
 * Build a Pollinations image URL for the given prompt.
 * Does NOT fetch the image — the URL itself, when used as an <img src>,
 * triggers Pollinations to generate and return the image on demand.
 */
export function buildPollinationsImageUrl(opts: GenerateImageOptions): string {
  const {
    prompt,
    width = 1024,
    height = 1024,
    model,
    seed,
    nologo = true,
  } = opts;

  const encoded = encodeURIComponent(prompt.trim() || 'a cute cat');
  const params = new URLSearchParams();
  params.set('width', String(width));
  params.set('height', String(height));
  if (model) params.set('model', model);
  if (typeof seed === 'number') params.set('seed', String(seed));
  if (nologo) params.set('nologo', 'true');

  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

/**
 * Available image generation models on Pollinations.
 * (Hardcoded for stability — the model list endpoint is unreliable.)
 */
export const POLLINATIONS_IMAGE_MODELS = [
  { id: 'flux', name: 'Flux', description: 'Default high-quality model' },
  { id: 'flux-realism', name: 'Flux Realism', description: 'Photorealistic' },
  { id: 'flux-anime', name: 'Flux Anime', description: 'Anime style' },
  { id: 'flux-3d', name: 'Flux 3D', description: '3D render style' },
  { id: 'turbo', name: 'Turbo', description: 'Fast generation, lower quality' },
] as const;

export type PollinationsImageModel = (typeof POLLINATIONS_IMAGE_MODELS)[number]['id'];
