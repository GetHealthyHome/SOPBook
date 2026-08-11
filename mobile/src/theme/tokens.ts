import { Platform } from 'react-native';

/**
 * Design tokens for a jobsite tool.
 *
 * Two constraints drive every value here and are worth stating, because they
 * override the usual "make it pretty" instincts:
 *
 *  1. The screen is read in direct sun, often through safety glasses, by
 *     someone whose hands are dirty. Contrast ratios are pushed past WCAG AA
 *     and nothing meaningful is communicated by color alone.
 *  2. Targets are sized for a gloved thumb. 44pt is Apple's minimum; the
 *     primary actions here are larger, because a mis-tap in an attic costs a
 *     climb back down.
 */

export const palette = {
  /** Charcoal, not pure black — pure black on OLED smears while scrolling. */
  ink: '#111214',
  inkSecondary: '#5A5F66',
  inkTertiary: '#8A9099',

  surface: '#FFFFFF',
  surfaceSecondary: '#F2F3F5',
  surfaceTertiary: '#E6E8EB',

  inkDark: '#F5F6F7',
  inkSecondaryDark: '#A6ADB5',
  inkTertiaryDark: '#6C737B',
  surfaceDark: '#101114',
  surfaceSecondaryDark: '#1B1D21',
  surfaceTertiaryDark: '#26292E',

  separator: 'rgba(60, 60, 67, 0.29)',
  separatorDark: 'rgba(84, 84, 88, 0.6)',

  /** Apple system colors, so the app reads as native rather than branded. */
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',

  /** High-visibility annotation inks, chosen to survive on any photo. */
  markerRed: '#FF2D2D',
  markerYellow: '#FFD60A',
  markerSafetyGreen: '#39FF14',
  markerWhite: '#FFFFFF',
} as const;

/** The stamp burned into the photo. Values are in image pixels, not points. */
export const stamp = {
  background: 'rgba(255, 255, 255, 0.9)',
  text: '#1C1C1E',
  padding: 8,
  cornerRadius: 6,
  /** Hard ceiling from the spec: the stamp must never dominate the frame. */
  maxWidthRatio: 0.15,
  /** Distance from the image's right and bottom edges. */
  margin: 16,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  /** Used only for pills and the shutter ring. */
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Minimum tap target. Anything interactive is at least this tall. */
export const HIT_TARGET = 44;

export const typography = {
  // `System` resolves to SF Pro on iOS and Roboto on Android; naming a font
  // file instead would break Dynamic Type and the user's chosen weight.
  family: Platform.select({ ios: 'System', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),

  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  separator: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export function themeFor(scheme: ColorScheme): Theme {
  const dark = scheme === 'dark';
  return {
    scheme,
    text: dark ? palette.inkDark : palette.ink,
    textSecondary: dark ? palette.inkSecondaryDark : palette.inkSecondary,
    textTertiary: dark ? palette.inkTertiaryDark : palette.inkTertiary,
    background: dark ? palette.surfaceDark : palette.surface,
    backgroundSecondary: dark ? palette.surfaceSecondaryDark : palette.surfaceSecondary,
    backgroundTertiary: dark ? palette.surfaceTertiaryDark : palette.surfaceTertiary,
    separator: dark ? palette.separatorDark : palette.separator,
    accent: palette.blue,
    success: palette.green,
    warning: palette.orange,
    danger: palette.red,
  };
}

/** Status color + SF Symbol, so status never depends on hue alone. */
export const JOB_STATUS_STYLE = {
  unscheduled: { color: palette.inkTertiary, symbol: 'calendar.badge.exclamationmark', label: 'Unscheduled' },
  scheduled: { color: palette.blue, symbol: 'calendar', label: 'Scheduled' },
  in_progress: { color: palette.orange, symbol: 'hammer.fill', label: 'In Progress' },
  completed: { color: palette.green, symbol: 'checkmark.circle.fill', label: 'Completed' },
  canceled: { color: palette.red, symbol: 'xmark.circle.fill', label: 'Canceled' },
  unknown: { color: palette.inkTertiary, symbol: 'questionmark.circle', label: 'Unknown' },
} as const;
