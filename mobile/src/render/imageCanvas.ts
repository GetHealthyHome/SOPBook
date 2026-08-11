import * as FileSystem from 'expo-file-system';
import {
  ImageFormat,
  Skia,
  type SkCanvas,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia';
import type { Rotation } from '@/capture/orientation';
import { computeOutputGeometry, MAX_OUTPUT_DIMENSION, type OutputGeometry } from './outputGeometry';
import { logger } from '@/utils/logger';

/**
 * JPEG quality for the flattened output. 88 is the knee of the curve for photos
 * of building assemblies — visually indistinguishable from 95 but roughly a
 * third smaller, which matters when the file crosses a jobsite LTE uplink.
 */
export const JPEG_QUALITY = 88;

export { computeOutputGeometry, MAX_OUTPUT_DIMENSION };
export type { OutputGeometry };

export async function decodeImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`Could not decode image at ${uri}`);
  return image;
}

/**
 * Draws `image` into `canvas` upright, applying EXIF rotation and downscale.
 *
 * Skia does not honor EXIF orientation when decoding, so without this a photo
 * taken in portrait decodes sideways — and the stamp, drawn in canvas space,
 * would land in the wrong corner of what the viewer sees. Baking the rotation
 * into the pixels here also means the saved JPEG needs no orientation tag and
 * displays correctly in Housecall Pro's web UI.
 *
 * Transform order note: Skia composes as `Translate * Rotate * Scale`, so the
 * calls below read in reverse of how a point flows through them.
 */
export function drawUprightImage(
  canvas: SkCanvas,
  image: SkImage,
  rotation: Rotation,
  geometry: OutputGeometry,
): void {
  const { outputWidth, outputHeight, scale } = geometry;

  canvas.save();
  switch (rotation) {
    case 90:
      canvas.translate(outputWidth, 0);
      canvas.rotate(90, 0, 0);
      break;
    case 180:
      canvas.translate(outputWidth, outputHeight);
      canvas.rotate(180, 0, 0);
      break;
    case 270:
      canvas.translate(0, outputHeight);
      canvas.rotate(270, 0, 0);
      break;
    default:
      break;
  }
  canvas.scale(scale, scale);
  canvas.drawImage(image, 0, 0);
  canvas.restore();
}

export function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    throw new Error(`Could not allocate a ${width}x${height} drawing surface`);
  }
  return surface;
}

/**
 * Encodes a surface to JPEG and writes it to `destinationUri`.
 *
 * Goes through base64 because that is the only encoding bridge Skia and
 * expo-file-system share. It transiently costs ~4/3 the file size in JS memory,
 * which is why `MAX_OUTPUT_DIMENSION` exists — at full sensor resolution this
 * step is where a mid-range Android runs out of heap.
 */
export async function writeSurfaceToFile(
  surface: SkSurface,
  destinationUri: string,
): Promise<void> {
  const snapshot = surface.makeImageSnapshot();
  const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);
  if (!base64) throw new Error('Could not encode the rendered image');

  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  logger.debug('render.written', { destinationUri, bytes: base64.length });
}
