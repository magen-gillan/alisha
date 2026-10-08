'use client';

/**
 * AI-powered texture replacement for Live2D avatars.
 *
 * Inspired by Nano-live2d (GBSOSS) — uses Pollinations image generation
 * API to create new clothing/textures based on text descriptions, then
 * swaps the avatar's texture at runtime.
 *
 * How it works:
 * 1. User describes the desired look (e.g. "red dress with gold trim")
 * 2. We call Pollinations image API to generate a 1024x1024 texture
 * 3. We replace the Live2D model's texture_00.png with the generated image
 * 4. The avatar immediately shows the new look
 *
 * NOTE: This is a best-effort approach. The generated image won't perfectly
 * match the UV mapping of the original texture, so results may vary.
 * For best results, the user should describe clothing/style, not full scenes.
 */

import { buildPollinationsImageUrl } from './image-gen';

export interface TextureChangeOptions {
  /** Text description of the desired look */
  prompt: string;
  /** Avatar model URL (to find which texture to replace) */
  modelUrl: string;
  /** Width of the generated texture (default 1024) */
  width?: number;
  /** Height of the generated texture (default 1024) */
  height?: number;
  /** Optional seed for reproducibility */
  seed?: number;
}

export interface TextureChangeResult {
  /** Data URL of the new texture */
  dataUrl: string;
  /** The original texture URL (for restoration) */
  originalUrl: string;
}

/**
 * Generate a new texture image using Pollinations AI.
 * Returns a data URL that can be used to replace the avatar's texture.
 */
export async function generateTexture(
  opts: TextureChangeOptions,
): Promise<TextureChangeResult> {
  const { prompt, width = 1024, height = 1024, seed } = opts;

  // Enhance the prompt for texture generation
  const enhancedPrompt = `${prompt}, anime style, character texture, flat coloring, simple background, high quality`;

  // Build the Pollinations image URL
  const imageUrl = buildPollinationsImageUrl({
    prompt: enhancedPrompt,
    width,
    height,
    seed,
    nologo: true,
  });

  // Fetch the generated image and convert to data URL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to generate texture (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);

  // The original texture URL (for potential restoration)
  // We extract it from the model3.json's texture path
  const originalUrl = extractTextureUrl(opts.modelUrl);

  return { dataUrl, originalUrl };
}

/**
 * Convert a Blob to a data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract the texture URL from a model3.json path.
 * E.g. "/live2d/jane/jane.model3.json" → "/live2d/jane/jane.8192/texture_00.png"
 * (We can't read the JSON synchronously, so we return a best-guess path.)
 */
function extractTextureUrl(modelUrl: string): string {
  // This is a placeholder — the actual texture path is in the model3.json
  // The caller should pass the correct texture URL if known.
  return modelUrl.replace(/\.model3\.json$/, '.8192/texture_00.png');
}

/**
 * Restore the original texture by reloading the model.
 * This is a no-op if the model hasn't been modified.
 */
export function restoreTexture(): void {
  // The simplest way to restore is to reload the model.
  // The caller should trigger a model reload (e.g., by changing avatarId
  // back and forth, or by calling the Live2DAvatar's init function again).
  // We can't directly manipulate PIXI textures from here without access
  // to the model instance.
}
