import type { ShapeKind } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned box between two dragged corners, in either drag direction. */
export function normalizeRect(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * Half-angle of the arrowhead barbs. Narrow enough to read as a point rather
 * than a chevron at a glance.
 */
const HEAD_SPREAD_RADIANS = Math.PI / 7;

/** Head length as a multiple of stroke width, before the shaft-length cap. */
const HEAD_TO_STROKE_RATIO = 5;

/** Fraction of the shaft the head may occupy. Beyond this it is all point. */
const MAX_HEAD_FRACTION = 0.45;

export interface ArrowHead {
  /** The two barb endpoints, both swept back from the tip. */
  barbs: [Point, Point];
  length: number;
}

/**
 * Barb endpoints for an arrow, or `null` when the drag is too short to deserve
 * a head at all — below roughly two stroke widths the head is bigger than the
 * arrow and the whole thing renders as a blob.
 *
 * Kept free of Skia so the sizing rules are unit-testable without a GPU surface.
 */
export function arrowHead(start: Point, end: Point, strokeWidthPx: number): ArrowHead | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const shaft = Math.hypot(dx, dy);

  if (shaft < strokeWidthPx * 2) return null;

  // Scaled off the stroke width so a heavy marker gets a proportionate head,
  // then capped against the shaft so a short arrow stays mostly shaft.
  const length = Math.min(strokeWidthPx * HEAD_TO_STROKE_RATIO, shaft * MAX_HEAD_FRACTION);
  const angle = Math.atan2(dy, dx);

  const barbAt = (sign: 1 | -1): Point => ({
    x: end.x - length * Math.cos(angle + sign * HEAD_SPREAD_RADIANS),
    y: end.y - length * Math.sin(angle + sign * HEAD_SPREAD_RADIANS),
  });

  return { barbs: [barbAt(-1), barbAt(1)], length };
}

/** True when a drag is long enough to be a deliberate shape rather than a misfire. */
export function isDeliberateDrag(start: Point, end: Point, minimum = 0.01): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > minimum;
}

/** Every shape the toolbar offers, for exhaustiveness checks. */
export const SHAPE_KINDS: ShapeKind[] = ['arrow', 'rect', 'ellipse'];
