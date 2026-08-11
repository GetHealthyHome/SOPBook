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
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'jest.setup.js', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      // Module mocks are written above the imports on purpose: Jest hoists them
      // regardless, and reading them first is what explains the imports below.
      'import/first': 'off',
      // A `jest.mock` factory is hoisted above every import, so it cannot close
      // over one. `require()` inside the factory is the only thing that works.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
