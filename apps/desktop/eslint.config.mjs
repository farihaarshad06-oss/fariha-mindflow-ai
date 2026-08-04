import mindflowConfig from '@mindflow/eslint-config';

export default [
  ...mindflowConfig,
  {
    ignores: ['src/generated/**'],
  },
  {
    // Allow intentionally-unused parameters and destructuring omissions
    // that are named with a leading underscore (TypeScript convention).
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
