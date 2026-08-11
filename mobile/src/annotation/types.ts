import { palette } from '@/theme';

/**
 * High-visibility inks. These are the only colors offered, chosen to stay
 * legible against the things retrofit photos are actually of: pink fiberglass,
 * grey ductwork, brown sheathing, and black attic voids.
 */
export const MARKER_COLORS = [
  { name: 'Red', value: palette.markerRed },
  { name: 'Yellow', value: palette.markerYellow },
  { name: 'Safety Green', value: palette.markerSafetyGreen },
  { name: 'White', value: palette.markerWhite },
] as const;

/**
 * Stroke widths as a fraction of the image's longest edge, not pixels.
 *
 * Normalizing here is what makes a stroke drawn on a 390pt phone preview come
 * out the same relative thickness in a 2560px export. A pixel width would
 * render as a hairline in the flattened file.
 */
export const STROKE_WIDTHS = [
  { name: 'Fine', value: 0.004 },
  { name: 'Medium', value: 0.008 },
  { name: 'Heavy', value: 0.016 },
] as const;

/** A point in normalized image space: 0,0 top-left, 1,1 bottom-right. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  kind: 'stroke';
  color: string;
  /** Fraction of the longest edge. See `STROKE_WIDTHS`. */
  width: number;
  points: NormalizedPoint[];
}

export interface TextAnnotation {
  id: string;
  kind: 'text';
  color: string;
  text: string;
  /** Top-left of the text, normalized. */
  position: NormalizedPoint;
  /** Fraction of the longest edge, so text scales with the export too. */
  fontSize: number;
}

/**
 * Shapes are stored as the two corners the tech dragged between, not as a
 * rasterized path. Freehand is for tracing; these are for pointing at a thing
 * and boxing a thing, which is what people actually reach for when marking a
 * defect — and a dragged rectangle is steadier than one drawn on a ladder.
 */
export type ShapeKind = 'arrow' | 'rect' | 'ellipse';

export interface ShapeAnnotation {
  id: string;
  kind: 'shape';
  shape: ShapeKind;
  color: string;
  /** Fraction of the longest edge. See `STROKE_WIDTHS`. */
  width: number;
  /** Where the drag began. For an arrow this is the tail. */
  start: NormalizedPoint;
  /** Where it ended. For an arrow this is the point. */
  end: NormalizedPoint;
}

export type Annotation = Stroke | TextAnnotation | ShapeAnnotation;

/**
 * Text sizes as a fraction of the longest edge, for the same reason stroke
 * widths are: a point size would render as unreadable specks in a 2560px export.
 */
export const TEXT_SIZES = [
  { name: 'Small', value: 0.012 },
  { name: 'Medium', value: 0.018 },
  { name: 'Large', value: 0.03 },
] as const;

/** ~46px at 2560. Kept as a named export; several call sites depend on it. */
export const DEFAULT_TEXT_SIZE = 0.018;

export type AnnotationTool = 'draw' | 'text' | ShapeKind;

/** Tools that are drawn by dragging from one corner to another. */
export function isShapeTool(tool: AnnotationTool): tool is ShapeKind {
  return tool === 'arrow' || tool === 'rect' || tool === 'ellipse';
}
