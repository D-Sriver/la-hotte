// ESLint : erreurs réelles et règles des hooks React. La mise en forme, c'est Prettier.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/', '.wrangler/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    // Espaces insécables voulus dans les textes (typographie française : « … », ?, !).
    rules: {
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true, skipJSXText: true, skipComments: true },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['functions/**/*.js', 'server/**/*.js', 'reminders/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.worker, ...globals.node } },
  },
  {
    files: ['tests/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
];
