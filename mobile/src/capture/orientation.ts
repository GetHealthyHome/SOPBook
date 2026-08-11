import type { PhotoOrientation } from '@/types';

/**
 * EXIF orientation → how many degrees the pixels must be rotated clockwise to
 * display upright.
 *
 * Only the four rotation-only values are handled. The mirrored variants
 * (2/4/5/7) are produced by front cameras on some devices and by editing
 * software; we normalize them to their non-mirrored rotation rather than
 * flipping, because a mirrored jobsite photo is a documentation defect, not a
 * look we want to reproduce faithfully.
 */
const EXIF_ROTATION: Record<number, 0 | 90 | 180 | 270> = {
  1: 0,
  2: 0,
  3: 180,
  4: 180,
  5: 90,
  6: 90,
  7: 270,
  8: 270,
};

export type Rotation = 0 | 90 | 180 | 270;

export function rotationFromExif(orientation: unknown): Rotation {
  if (typeof orientation !== 'number') return 0;
  return EXIF_ROTATION[orientation] ?? 0;
}

/** 90° and 270° swap the output canvas's width and height. */
export function swapsDimensions(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

/**
 * How the device was held, recorded alongside the photo.
 *
 * Derived from EXIF rather than from the screen, because the app is locked to
 * portrait — `ScreenOrientation` would report "portrait" no matter how the
 * phone was actually turned.
 */
export function orientationFromExif(orientation: unknown): PhotoOrientation {
  switch (rotationFromExif(orientation)) {
    case 90:
      return 'portrait';
    case 270:
      return 'portrait_upside_down';
    case 180:
      return 'landscape_right';
    default:
      return 'landscape_left';
  }
}
