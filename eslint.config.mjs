// ESLint 9 flat config.
//
// Replaces .eslintrc.json, which ESLint 9 no longer reads. eslint-config-next
// 16 ships native flat config, so this spreads it directly rather than going
// through the FlatCompat shim.
//
// `next lint` was removed in Next 16, so package.json calls eslint directly.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      // next-pwa / Serwist build output — generated, not authored.
      'public/sw.js',
      'public/workbox-*.js',
      'public/swe-worker-*.js',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Next 16's config adds the React Compiler lint rules. They flag
      // long-standing patterns here — a reset-on-prop-change, effects that
      // set state on mount, lazy loading when a view is first opened, and a
      // timer held in a ref. None is a bug, and none has any effect while the
      // app runs React 18 without the compiler.
      //
      // Kept as warnings rather than switched off: they are real signal for
      // the day the compiler is adopted, and that refactor deserves its own
      // change rather than riding along with a framework upgrade.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];
