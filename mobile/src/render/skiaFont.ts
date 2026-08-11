import { FontStyle, Skia, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { logger } from '@/utils/logger';

/**
 * Monospaced families in preference order. The stamp is fixed-width text whose
 * box is sized from a character count, so a proportional fallback would make
 * the measured width wrong and the text overflow its box.
 */
const MONO_FAMILIES = ['Menlo', 'Courier New', 'monospace', 'Roboto Mono', 'DejaVu Sans Mono'];

let cachedTypeface: SkTypeface | null | undefined;

function resolveMonoTypeface(): SkTypeface | null {
  if (cachedTypeface !== undefined) return cachedTypeface;

  try {
    const fontMgr = Skia.FontMgr.System();
    for (const family of MONO_FAMILIES) {
      // Typed as non-nullable, but returns null at runtime for a family the
      // platform does not have — which is the normal case for most of this list.
      const typeface = fontMgr.matchFamilyStyle(family, FontStyle.Normal) as SkTypeface | null;
      if (typeface) {
        cachedTypeface = typeface;
        return typeface;
      }
    }
    // No named match — fall back to the platform default rather than failing
    // the capture. The stamp stays legible; only the character advance changes,
    // and that is measured at runtime anyway.
    cachedTypeface = null;
  } catch (error) {
    logger.warn('skia.font.resolve_failed', { error: String(error) });
    cachedTypeface = null;
  }

  return cachedTypeface;
}

export function makeMonoFont(size: number): SkFont {
  const typeface = resolveMonoTypeface();
  return typeface ? Skia.Font(typeface, size) : Skia.Font(undefined, size);
}

/**
 * Advance width of one character as a fraction of font size.
 *
 * Measured from the real font at a probe size rather than assumed, because the
 * stamp box is solved algebraically from this number — guessing 0.6 and being
 * wrong by 10% means text that runs outside its white box on every photo.
 */
export function measureAdvanceRatio(): number {
  const PROBE_SIZE = 100;
  const PROBE_TEXT = '0123456789';
  try {
    const font = makeMonoFont(PROBE_SIZE);
    const width = font.measureText(PROBE_TEXT).width;
    if (width > 0) return width / PROBE_TEXT.length / PROBE_SIZE;
  } catch (error) {
    logger.warn('skia.font.measure_failed', { error: String(error) });
  }
  // Typical monospace advance. Only reached if measurement throws.
  return 0.6;
}
