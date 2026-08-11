import { formatStampCoordinates, formatStampTimestamp, pluralize } from '../format';

describe('formatStampTimestamp', () => {
  it('renders the exact format burned into the photo', () => {
    // Constructed from local components so the assertion holds in any TZ the
    // CI box happens to be set to.
    const date = new Date(2026, 7, 11, 9, 5, 3);
    expect(formatStampTimestamp(date)).toBe('2026-08-11 | 09:05:03');
  });

  it('zero-pads every component so the stamp is a fixed width', () => {
    // Fixed width matters: the stamp box is sized once, and a one-character
    // swing would either clip the text or leave the box ragged.
    const date = new Date(2026, 0, 1, 0, 0, 0);
    expect(formatStampTimestamp(date)).toBe('2026-01-01 | 00:00:00');
  });
});

describe('formatStampCoordinates', () => {
  it('renders six decimals, padding shorter values', () => {
    expect(formatStampCoordinates(40.1, -105.2)).toBe('Lat: 40.100000, Lon: -105.200000');
  });

  it('rounds rather than truncating longer values', () => {
    expect(formatStampCoordinates(40.0166667, -105.2811111)).toBe(
      'Lat: 40.016667, Lon: -105.281111',
    );
  });
});

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'photo')).toBe('1 photo');
    expect(pluralize(0, 'photo')).toBe('0 photos');
    expect(pluralize(3, 'photo')).toBe('3 photos');
  });
});
