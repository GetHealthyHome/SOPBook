import { computeStampLayout } from '../stampLayout';
import { orientationFromExif, rotationFromExif, swapsDimensions } from '../orientation';
import { stamp } from '@/theme';

const SENSOR = { width: 4032, height: 3024 };
// Real measured advance for Menlo/Courier-class monospace faces.
const ADVANCE = 0.6;
// "Lat: 40.016667, Lon: -105.281111" is the longest line the stamp renders.
const LONGEST_LINE = 32;

function layoutFor(imageWidth: number, imageHeight: number) {
  return computeStampLayout({
    imageWidth,
    imageHeight,
    longestLineChars: LONGEST_LINE,
    advanceRatio: ADVANCE,
    lineCount: 2,
  });
}

describe('computeStampLayout', () => {
  it('keeps the box under the 15% width cap on a real sensor frame', () => {
    const layout = layoutFor(SENSOR.width, SENSOR.height);
    expect(layout.boxWidth).toBeLessThanOrEqual(SENSOR.width * stamp.maxWidthRatio);
    expect(layout.exceedsWidthCap).toBe(false);
  });

  it('sits in the lower-right with a margin on both edges', () => {
    const layout = layoutFor(SENSOR.width, SENSOR.height);
    expect(layout.boxX + layout.boxWidth).toBeLessThan(SENSOR.width);
    expect(layout.boxY + layout.boxHeight).toBeLessThan(SENSOR.height);
    // Comfortably past the midpoint on both axes — that is what "corner" means.
    expect(layout.boxX).toBeGreaterThan(SENSOR.width / 2);
    expect(layout.boxY).toBeGreaterThan(SENSOR.height / 2);
  });

  it('scales the font with the image so the stamp is proportional, not fixed', () => {
    // The failure this guards against is an 8px stamp on a 4032px photo:
    // technically present, unreadable in practice.
    const small = layoutFor(1080, 1920);
    const large = layoutFor(4032, 3024);
    expect(large.fontSize).toBeGreaterThan(small.fontSize);
    expect(large.padding).toBeGreaterThan(small.padding);
  });

  it('never renders text below the legibility floor, even if the cap must break', () => {
    const layout = layoutFor(320, 240);
    expect(layout.fontSize).toBeGreaterThanOrEqual(9);
    // And it tells the caller the cap was broken rather than doing it silently.
    expect(layout.exceedsWidthCap).toBe(true);
  });

  it('leaves room for every line inside the box', () => {
    const layout = layoutFor(SENSOR.width, SENSOR.height);
    const lastBaseline = layout.firstBaselineY + layout.lineHeight;
    expect(lastBaseline).toBeLessThanOrEqual(layout.boxY + layout.boxHeight);
  });

  it('grows the box height with the number of lines', () => {
    const two = computeStampLayout({
      imageWidth: SENSOR.width,
      imageHeight: SENSOR.height,
      longestLineChars: LONGEST_LINE,
      advanceRatio: ADVANCE,
      lineCount: 2,
    });
    const three = computeStampLayout({
      imageWidth: SENSOR.width,
      imageHeight: SENSOR.height,
      longestLineChars: LONGEST_LINE,
      advanceRatio: ADVANCE,
      lineCount: 3,
    });
    expect(three.boxHeight).toBeGreaterThan(two.boxHeight);
  });
});

describe('rotationFromExif', () => {
  it('maps the four rotation-only orientations', () => {
    expect(rotationFromExif(1)).toBe(0);
    expect(rotationFromExif(6)).toBe(90);
    expect(rotationFromExif(3)).toBe(180);
    expect(rotationFromExif(8)).toBe(270);
  });

  it('normalizes mirrored variants to their rotation instead of flipping', () => {
    expect(rotationFromExif(2)).toBe(0);
    expect(rotationFromExif(7)).toBe(270);
  });

  it('defaults to no rotation when EXIF is absent or junk', () => {
    // Android devices routinely omit the tag; that must not rotate the photo.
    expect(rotationFromExif(undefined)).toBe(0);
    expect(rotationFromExif('6')).toBe(0);
    expect(rotationFromExif(99)).toBe(0);
  });
});

describe('swapsDimensions', () => {
  it('is true only for the quarter turns', () => {
    expect(swapsDimensions(90)).toBe(true);
    expect(swapsDimensions(270)).toBe(true);
    expect(swapsDimensions(0)).toBe(false);
    expect(swapsDimensions(180)).toBe(false);
  });
});

describe('orientationFromExif', () => {
  it('records how the device was held', () => {
    expect(orientationFromExif(6)).toBe('portrait');
    expect(orientationFromExif(8)).toBe('portrait_upside_down');
    expect(orientationFromExif(1)).toBe('landscape_left');
    expect(orientationFromExif(3)).toBe('landscape_right');
  });
});
