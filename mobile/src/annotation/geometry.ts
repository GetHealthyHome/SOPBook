import type { NormalizedPoint } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the photo actually sits inside its container under `contentFit: contain`.
 *
 * This is the crux of annotation correctness. The canvas is a rectangle of the
 * screen, but the photo is letterboxed inside it, and a touch at the top-left
 * of the *canvas* is not the top-left of the *image*. Mapping through this rect
 * is what keeps a circle drawn around a duct leak landing on the duct leak in
 * the exported file instead of offset by the letterbox bars.
 */
export function computeContainRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): Rect {
  if (imageWidth <= 0 || imageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

/** Screen point → normalized image space. Clamped so a drag off-image stays on-image. */
export function toNormalized(x: number, y: number, rect: Rect): NormalizedPoint {
  return {
    x: clamp01((x - rect.x) / rect.width),
    y: clamp01((y - rect.y) / rect.height),
  };
}

/** Normalized image space → screen point, for rendering the live preview. */
export function toScreen(point: NormalizedPoint, rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Converts a normalized width fraction into pixels for a given render target.
 * Uses the longest edge so a stroke keeps its thickness whichever way the
 * photo is oriented.
 */
export function scalarToPixels(fraction: number, width: number, height: number): number {
  return fraction * Math.max(width, height);
}
