import { swapsDimensions, type Rotation } from '@/capture/orientation';

/**
 * Longest edge of a saved photo. A 12 MP sensor frame is ~4032px and 4-6 MB;
 * downscaling to 2560 keeps every detail an auditor needs while cutting upload
 * size (and the offline queue's disk footprint) by more than half.
 */
export const MAX_OUTPUT_DIMENSION = 2560;

export interface OutputGeometry {
  outputWidth: number;
  outputHeight: number;
  scale: number;
}

/**
 * Output canvas size after applying rotation and the downscale cap.
 *
 * The cap is applied to the *displayed* edges, so a photo shot sideways is
 * capped on the edge the viewer actually sees as long.
 *
 * Kept free of Skia imports so the math is unit-testable without a GPU surface
 * or the native runtime.
 */
export function computeOutputGeometry(
  imageWidth: number,
  imageHeight: number,
  rotation: Rotation,
  maxDimension = MAX_OUTPUT_DIMENSION,
): OutputGeometry {
  const displayWidth = swapsDimensions(rotation) ? imageHeight : imageWidth;
  const displayHeight = swapsDimensions(rotation) ? imageWidth : imageHeight;

  const longestEdge = Math.max(displayWidth, displayHeight);
  const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1;

  return {
    outputWidth: Math.round(displayWidth * scale),
    outputHeight: Math.round(displayHeight * scale),
    scale,
  };
}
