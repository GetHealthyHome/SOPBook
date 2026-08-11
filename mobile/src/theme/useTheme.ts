import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { themeFor, type Theme } from './tokens';

/** Resolves the active theme. Follows the system setting; there is no in-app override. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return useMemo(() => themeFor(scheme === 'dark' ? 'dark' : 'light'), [scheme]);
}
