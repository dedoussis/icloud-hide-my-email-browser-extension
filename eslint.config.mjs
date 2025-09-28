import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const jsFiles = ['**/*.{js,jsx}'];
const tsFiles = ['**/*.{ts,tsx}'];

const nodeGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  exports: 'readonly',
  module: 'readonly',
  require: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  MutationObserver: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  alert: 'readonly',
};

const reactConfigs = reactPlugin.configs;
const reactHooksConfigs = reactHooksPlugin.configs;
const jsxA11yConfigs = jsxA11yPlugin.configs;
const importConfigs = importPlugin.configs;

export default [
  {
    ignores: ['build/**', '.brave-debug-profile/**'],
  },
  {
    files: jsFiles,
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...nodeGlobals,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      ...importConfigs.typescript.settings,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...importConfigs.recommended.rules,
      ...importConfigs.typescript.rules,
      ...reactConfigs.recommended.rules,
      ...reactHooksConfigs.recommended.rules,
      ...jsxA11yConfigs.recommended.rules,
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      'import/no-unresolved': 'off',
      'no-undef': 'off',
    },
  },
];
