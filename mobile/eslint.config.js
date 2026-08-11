const expoConfig = require('eslint-config-expo/flat');

/**
 * ESLint 9 flat config. The `lint` script was pointing at a config that did not
 * exist, so linting has never actually run against this project.
 */
module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'dist/**'],
  },
];
