const WARN = 'warn';

export const node = [
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      'no-process-exit': WARN,
    },
  },
];

export default node;
