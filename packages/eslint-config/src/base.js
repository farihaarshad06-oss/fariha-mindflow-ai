import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const WARN = 'warn';

export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/playwright-report/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': WARN,
      '@typescript-eslint/no-explicit-any': WARN,
      '@typescript-eslint/no-empty-object-type': WARN,
      '@typescript-eslint/no-non-null-assertion': WARN,
      'no-console': WARN,
      'no-unused-vars': 'off',
      'no-empty': WARN,
    },
  },
];

export default base;
