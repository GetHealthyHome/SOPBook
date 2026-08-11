import { computeContainRect, scalarToPixels, toNormalized, toScreen } from '../geometry';
import { computeOutputGeometry } from '@/render/outputGeometry';

describe('computeContainRect', () => {
  it('letterboxes a landscape photo in a portrait container', () => {
    // 4:3 photo in a 390x600 container fits by width, leaving bars top and bottom.
    const rect = computeContainRect(390, 600, 4000, 3000);
    expect(rect.width).toBeCloseTo(390);
    expect(rect.height).toBeCloseTo(292.5);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo(153.75);
  });

  it('pillarboxes a portrait photo in a landscape container', () => {
    const rect = computeContainRect(600, 390, 3000, 4000);
    expect(rect.height).toBeCloseTo(390);
    expect(rect.width).toBeCloseTo(292.5);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.x).toBeCloseTo(153.75);
  });

  it('degrades safely rather than dividing by zero before layout lands', () => {
    const rect = computeContainRect(390, 600, 0, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: 390, height: 600 });
  });
});

describe('toNormalized', () => {
  const rect = { x: 0, y: 150, width: 390, height: 300 };

  it('maps a touch inside the letterboxed photo to image space', () => {
    // The centre of the photo, which is NOT the centre of the container.
    expect(toNormalized(195, 300, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps a drag that leaves the photo onto its edge', () => {
    // Without this, a stroke dragged into the letterbox bar would be stored at
    // a negative coordinate and vanish when flattened.
    expect(toNormalized(-40, 10, rect)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });

  it('round-trips through toScreen', () => {
    const point = toNormalized(120, 240, rect);
    const screen = toScreen(point, rect);
    expect(screen.x).toBeCloseTo(120);
    expect(screen.y).toBeCloseTo(240);
  });
});

describe('scalarToPixels', () => {
  it('scales off the longest edge so thickness survives orientation', () => {
    expect(scalarToPixels(0.008, 2560, 1920)).toBeCloseTo(20.48);
    expect(scalarToPixels(0.008, 1920, 2560)).toBeCloseTo(20.48);
  });
});

describe('computeOutputGeometry', () => {
  it('swaps width and height for a quarter turn', () => {
    const geometry = computeOutputGeometry(4032, 3024, 90, 10_000);
    expect(geometry.outputWidth).toBe(3024);
    expect(geometry.outputHeight).toBe(4032);
    expect(geometry.scale).toBe(1);
  });

  it('downscales the longest edge to the cap', () => {
    const geometry = computeOutputGeometry(4032, 3024, 0, 2560);
    expect(geometry.outputWidth).toBe(2560);
    expect(geometry.outputHeight).toBe(1920);
  });

  it('applies the cap to the displayed edge after rotation', () => {
    const geometry = computeOutputGeometry(4032, 3024, 90, 2560);
    expect(Math.max(geometry.outputWidth, geometry.outputHeight)).toBe(2560);
    expect(geometry.outputWidth).toBe(1920);
    expect(geometry.outputHeight).toBe(2560);
  });

  it('never upscales a photo that is already under the cap', () => {
    const geometry = computeOutputGeometry(800, 600, 0, 2560);
    expect(geometry.scale).toBe(1);
    expect(geometry.outputWidth).toBe(800);
  });
});
