import { stamp } from '@/theme';

/**
 * Font size at which the token values in `theme.stamp` (8px padding, 6px
 * corner radius, 16px margin) are correctly proportioned. Everything scales
 * off this, so the stamp looks identical on a 1080px phone frame and a 4032px
 * sensor frame instead of vanishing on the latter.
 */
const BASE_FONT_SIZE = 12;

/**
 * Never render text smaller than this, even if honoring the width cap would
 * demand it. An illegible stamp defeats the entire purpose of burning one in.
 */
const MIN_FONT_SIZE = 9;

/** Keeps the stamp from ballooning on very large sensors. */
const MAX_FONT_SIZE = 48;

export interface StampLayoutInput {
  imageWidth: number;
  imageHeight: number;
  /** Character count of the longest line. Monospace, so count is enough. */
  longestLineChars: number;
  /** Advance width of one character divided by font size, measured at runtime. */
  advanceRatio: number;
  lineCount: number;
}

export interface StampLayout {
  fontSize: number;
  padding: number;
  cornerRadius: number;
  lineHeight: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  /** X of the text's left edge. */
  textX: number;
  /** Baseline Y of the first line. */
  firstBaselineY: number;
  /** True when the width cap had to be broken to keep the text legible. */
  exceedsWidthCap: boolean;
}

/**
 * Solves for the largest font size whose box still fits the width budget.
 *
 * The box is `2 * padding + chars * advance`, and padding itself scales with
 * the font, so this is one linear equation rather than an iterative fit:
 *
 *   box(f) = f * (2 * paddingRatio + chars * advanceRatio) <= maxWidth
 *
 * Kept as a pure function so the geometry is testable without a GPU surface.
 */
export function computeStampLayout(input: StampLayoutInput): StampLayout {
  const { imageWidth, imageHeight, longestLineChars, advanceRatio, lineCount } = input;

  const paddingRatio = stamp.padding / BASE_FONT_SIZE;
  const maxWidth = imageWidth * stamp.maxWidthRatio;
  const widthPerFontUnit = 2 * paddingRatio + longestLineChars * advanceRatio;

  const idealFontSize = maxWidth / widthPerFontUnit;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, idealFontSize));

  const scale = fontSize / BASE_FONT_SIZE;
  const padding = stamp.padding * scale;
  const cornerRadius = stamp.cornerRadius * scale;
  const margin = stamp.margin * scale;
  const lineHeight = fontSize * 1.25;

  const textWidth = longestLineChars * advanceRatio * fontSize;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = lineHeight * lineCount + padding * 2;

  return {
    fontSize,
    padding,
    cornerRadius,
    lineHeight,
    // Lower-right, inset by the margin.
    boxX: imageWidth - boxWidth - margin,
    boxY: imageHeight - boxHeight - margin,
    boxWidth,
    boxHeight,
    textX: imageWidth - boxWidth - margin + padding,
    // Baseline sits one line-height below the box top, plus padding.
    firstBaselineY: imageHeight - boxHeight - margin + padding + fontSize,
    exceedsWidthCap: boxWidth > maxWidth,
  };
}
