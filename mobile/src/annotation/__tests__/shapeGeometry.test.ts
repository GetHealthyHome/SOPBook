import { arrowHead, isDeliberateDrag, normalizeRect } from '../shapeGeometry';

describe('normalizeRect', () => {
  it('produces the same box whichever corner the drag started from', () => {
    const downRight = normalizeRect({ x: 10, y: 20 }, { x: 110, y: 70 });
    const upLeft = normalizeRect({ x: 110, y: 70 }, { x: 10, y: 20 });

    expect(downRight).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(upLeft).toEqual(downRight);
  });
});

describe('arrowHead', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 300, y: 0 };

  it('places both barbs behind the tip, one on each side of the shaft', () => {
    const head = arrowHead(start, end, 10)!;
    const [above, below] = head.barbs;

    expect(above.x).toBeLessThan(end.x);
    expect(below.x).toBeLessThan(end.x);
    // A horizontal arrow must have one barb above the shaft and one below, or
    // it renders as a bent line rather than a point.
    expect(Math.sign(above.y)).toBe(-Math.sign(below.y));
  });

  it('scales the head with stroke width, so a heavy marker is not tipped by a pinprick', () => {
    expect(arrowHead(start, end, 4)!.length).toBeLessThan(arrowHead(start, end, 12)!.length);
  });

  it('caps the head against the shaft so a short arrow is not all point', () => {
    // Long enough to carry a head at all, short enough that the stroke-width
    // rule alone would give it one nearly as long as the arrow.
    const shaft = 40;
    const head = arrowHead(start, { x: shaft, y: 0 }, 10)!;
    expect(head.length).toBeLessThanOrEqual(shaft * 0.45);
    expect(head.length).toBeLessThan(10 * 5);
  });

  it('omits the head entirely on a drag too short to carry one', () => {
    // Below this the head would be larger than the arrow, which reads as a blob.
    expect(arrowHead(start, { x: 12, y: 0 }, 10)).toBeNull();
  });

  it('follows the drag direction rather than assuming an axis', () => {
    const diagonal = arrowHead(start, { x: 200, y: 200 }, 8)!;
    for (const barb of diagonal.barbs) {
      expect(barb.x).toBeLessThan(200);
      expect(barb.y).toBeLessThan(200);
    }
  });
});

describe('isDeliberateDrag', () => {
  it('rejects a tap made with a shape tool selected', () => {
    expect(isDeliberateDrag({ x: 0.5, y: 0.5 }, { x: 0.502, y: 0.5 })).toBe(false);
  });

  it('accepts a drag long enough to see', () => {
    expect(isDeliberateDrag({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.5 })).toBe(true);
  });
});
