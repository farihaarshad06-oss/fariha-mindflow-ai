const WARN = 'warn';

export const nest = [
  {
    files: ['**/services/api/**/*.{ts,js}'],
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      'no-console': WARN,
    },
  },
];

export default nest;
