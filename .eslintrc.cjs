/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    '.vercel/',
    '.next/',
    '**/*.min.*',
  ],
  rules: {
    // Pragmatic defaults for a TS + React codebase with some legacy modules.
    // Keep lint focused on issues that break behavior, not stylistic churn.

    // TypeScript already provides types; prop-types is noise.
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',

    // Legacy code uses many intentional empty catches/blocks.
    'no-empty': 'off',

    // Common in TS/React apps (dynamic imports/conditional requires in a few areas).
    '@typescript-eslint/no-var-requires': 'off',

    // Text content in JSX often includes apostrophes/quotes.
    'react/no-unescaped-entities': 'off',

    // These rules are frequently hit in older code and are not worth blocking the build.
    'no-case-declarations': 'off',
    'no-unsafe-finally': 'off',
    'no-useless-escape': 'off',
    'no-useless-catch': 'off',
    'no-mixed-spaces-and-tabs': 'off',
    'no-misleading-character-class': 'off',
    'prefer-const': 'off',

    // Keep repo moving: allow explicit any and unused vars with leading underscore.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],

    // Similar to plugin:react-refresh/recommended (flat-config), but compatible with eslintrc.
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
