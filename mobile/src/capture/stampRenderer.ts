import { Skia } from '@shopify/react-native-skia';
import { computeStampLayout } from './stampLayout';
import { rotationFromExif, type Rotation } from './orientation';
import {
  computeOutputGeometry,
  decodeImage,
  drawUprightImage,
  makeSurface,
  writeSurfaceToFile,
} from '@/render/imageCanvas';
import { makeMonoFont, measureAdvanceRatio } from '@/render/skiaFont';
import { stamp } from '@/theme';
import { formatStampCoordinates, formatStampTimestamp } from '@/utils/format';
import { logger } from '@/utils/logger';
import type { CaptureLocation } from '@/types';

export interface StampRenderInput {
  /** Camera output, still carrying its EXIF orientation. */
  sourceUri: string;
  destinationUri: string;
  capturedAt: Date;
  location?: CaptureLocation;
  exifOrientation?: unknown;
}

export interface StampRenderResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Burns the metadata stamp into the lower-right corner and writes the result.
 *
 * This runs before the photo is ever shown as "saved", so the stamp is part of
 * the file from the first moment it exists on disk. There is no code path that
 * produces an unstamped saved photo — that is the point of the feature, since
 * a stamp that can be skipped is a stamp an auditor cannot trust.
 */
export async function renderStampedPhoto(input: StampRenderInput): Promise<StampRenderResult> {
  const image = await decodeImage(input.sourceUri);
  const rotation: Rotation = rotationFromExif(input.exifOrientation);
  const geometry = computeOutputGeometry(image.width(), image.height(), rotation);

  const surface = makeSurface(geometry.outputWidth, geometry.outputHeight);
  const canvas = surface.getCanvas();

  drawUprightImage(canvas, image, rotation, geometry);

  const lines = buildStampLines(input.capturedAt, input.location);
  drawStamp(canvas, geometry.outputWidth, geometry.outputHeight, lines);

  await writeSurfaceToFile(surface, input.destinationUri);

  return {
    uri: input.destinationUri,
    width: geometry.outputWidth,
    height: geometry.outputHeight,
  };
}

/**
 * The two lines of the stamp. When there is no GPS fix the second line says so
 * explicitly rather than being omitted — a stamp with a missing coordinate line
 * is ambiguous between "no fix" and "stamp rendered before the fix arrived",
 * and only one of those is defensible in a dispute.
 */
export function buildStampLines(capturedAt: Date, location?: CaptureLocation): string[] {
  return [
    formatStampTimestamp(capturedAt),
    location
      ? formatStampCoordinates(location.latitude, location.longitude)
      : 'Lat: --.------, Lon: ---.------',
  ];
}

function drawStamp(
  canvas: ReturnType<ReturnType<typeof makeSurface>['getCanvas']>,
  width: number,
  height: number,
  lines: string[],
): void {
  const advanceRatio = measureAdvanceRatio();
  const longestLineChars = lines.reduce((max, line) => Math.max(max, line.length), 0);

  const layout = computeStampLayout({
    imageWidth: width,
    imageHeight: height,
    longestLineChars,
    advanceRatio,
    lineCount: lines.length,
  });

  if (layout.exceedsWidthCap) {
    // Legibility beat the 15% cap. Worth knowing about, not worth failing over.
    logger.info('stamp.width_cap_exceeded', { width, boxWidth: layout.boxWidth });
  }

  const boxPaint = Skia.Paint();
  boxPaint.setColor(Skia.Color(stamp.background));
  boxPaint.setAntiAlias(true);

  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(layout.boxX, layout.boxY, layout.boxWidth, layout.boxHeight),
      layout.cornerRadius,
      layout.cornerRadius,
    ),
    boxPaint,
  );

  const textPaint = Skia.Paint();
  textPaint.setColor(Skia.Color(stamp.text));
  textPaint.setAntiAlias(true);

  const font = makeMonoFont(layout.fontSize);
  lines.forEach((line, index) => {
    canvas.drawText(
      line,
      layout.textX,
      layout.firstBaselineY + index * layout.lineHeight,
      textPaint,
      font,
    );
  });
}
