import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { scalarToPixels } from './geometry';
import { arrowHead, normalizeRect } from './shapeGeometry';
import type {
  Annotation,
  NormalizedPoint,
  ShapeAnnotation,
  TextAnnotation,
} from './types';
import { decodeImage, makeSurface, writeSurfaceToFile } from '@/render/imageCanvas';
import { makeMonoFont } from '@/render/skiaFont';
import { logger } from '@/utils/logger';

/**
 * Builds a smooth path through normalized points.
 *
 * Quadratic midpoint smoothing rather than straight `lineTo` segments: a finger
 * drag arrives as ~60 sparse samples per second, and joining them with lines
 * produces visibly faceted arrows and circles. Each segment curves toward the
 * sample point and lands on the midpoint of the next, which is the cheapest
 * technique that reads as hand-drawn.
 */
export function buildStrokePath(
  points: NormalizedPoint[],
  toPixels: (point: NormalizedPoint) => { x: number; y: number },
): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  const first = toPixels(points[0]!);
  path.moveTo(first.x, first.y);

  // A single tap should still leave a visible dot, not nothing.
  if (points.length === 1) {
    path.lineTo(first.x, first.y);
    return path;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = toPixels(points[index]!);
    const next = toPixels(points[index + 1]!);
    path.quadTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  const last = toPixels(points[points.length - 1]!);
  path.lineTo(last.x, last.y);
  return path;
}

/**
 * Path for a dragged shape, in pixels.
 *
 * Shared by the live preview and the flattening pass for the same reason
 * `drawAnnotations` is: an arrowhead that looked one way while drawing and
 * another way in the saved file would be a bug nobody notices until an auditor
 * is looking at the photo.
 */
export function buildShapePath(
  shape: ShapeAnnotation['shape'],
  start: { x: number; y: number },
  end: { x: number; y: number },
  strokeWidthPx: number,
): SkPath {
  const path = Skia.Path.Make();

  if (shape === 'rect' || shape === 'ellipse') {
    const box = normalizeRect(start, end);
    const rect = Skia.XYWHRect(box.x, box.y, box.width, box.height);
    if (shape === 'rect') path.addRect(rect);
    else path.addOval(rect);
    return path;
  }

  // Arrow: a shaft plus two barbs swept back from the tip.
  path.moveTo(start.x, start.y);
  path.lineTo(end.x, end.y);

  const head = arrowHead(start, end, strokeWidthPx);
  if (!head) return path;

  for (const barb of head.barbs) {
    path.moveTo(end.x, end.y);
    path.lineTo(barb.x, barb.y);
  }

  return path;
}

function strokePaint(color: string, widthFraction: number, width: number, height: number) {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(scalarToPixels(widthFraction, width, height));
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setAntiAlias(true);
  return paint;
}

/**
 * Draws annotations onto a canvas of the given pixel size.
 *
 * Shared by the live preview and the flattening pass, so what a tech sees while
 * drawing is produced by the same code that writes the file. Two code paths
 * here would mean the preview and the saved photo could silently diverge.
 */
export function drawAnnotations(
  canvas: SkCanvas,
  annotations: Annotation[],
  width: number,
  height: number,
): void {
  const toPixels = (point: NormalizedPoint) => ({ x: point.x * width, y: point.y * height });

  for (const annotation of annotations) {
    if (annotation.kind === 'stroke') {
      canvas.drawPath(
        buildStrokePath(annotation.points, toPixels),
        strokePaint(annotation.color, annotation.width, width, height),
      );
    } else if (annotation.kind === 'shape') {
      canvas.drawPath(
        buildShapePath(
          annotation.shape,
          toPixels(annotation.start),
          toPixels(annotation.end),
          scalarToPixels(annotation.width, width, height),
        ),
        strokePaint(annotation.color, annotation.width, width, height),
      );
    } else {
      drawTextAnnotation(canvas, annotation, width, height);
    }
  }
}

function drawTextAnnotation(
  canvas: SkCanvas,
  annotation: TextAnnotation,
  width: number,
  height: number,
): void {
  const fontSize = scalarToPixels(annotation.fontSize, width, height);
  const font = makeMonoFont(fontSize);
  const origin = { x: annotation.position.x * width, y: annotation.position.y * height };

  // A dark halo behind the glyphs. Without it, white text vanishes against
  // fiberglass and yellow vanishes against pine — and the annotation a tech
  // added is precisely the part that must survive.
  const halo = Skia.Paint();
  halo.setColor(Skia.Color('rgba(0, 0, 0, 0.55)'));
  halo.setStyle(PaintStyle.Stroke);
  halo.setStrokeWidth(Math.max(1, fontSize * 0.12));
  halo.setStrokeJoin(StrokeJoin.Round);
  halo.setAntiAlias(true);

  const fill = Skia.Paint();
  fill.setColor(Skia.Color(annotation.color));
  fill.setAntiAlias(true);

  // Baseline sits one font size below the stored top-left origin.
  const baselineY = origin.y + fontSize;
  canvas.drawText(annotation.text, origin.x, baselineY, halo, font);
  canvas.drawText(annotation.text, origin.x, baselineY, fill, font);
}

export interface FlattenInput {
  /** The already-stamped image. */
  sourceUri: string;
  destinationUri: string;
  annotations: Annotation[];
}

export interface FlattenResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Bakes annotations into the image and writes a new file.
 *
 * Writes to a *different* URI than it reads, then the caller swaps the photo
 * row over. Rendering in place would mean a crash mid-encode leaves a truncated
 * JPEG where the only copy of the tech's photo used to be.
 */
export async function flattenAnnotations(input: FlattenInput): Promise<FlattenResult> {
  const image = await decodeImage(input.sourceUri);
  const width = image.width();
  const height = image.height();

  const surface = makeSurface(width, height);
  const canvas = surface.getCanvas();

  canvas.drawImage(image, 0, 0);
  drawAnnotations(canvas, input.annotations, width, height);

  await writeSurfaceToFile(surface, input.destinationUri);
  logger.info('annotation.flattened', { count: input.annotations.length, width, height });

  return { uri: input.destinationUri, width, height };
}
