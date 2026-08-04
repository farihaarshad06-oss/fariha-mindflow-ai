import mindflowConfig from '@mindflow/eslint-config';

export default [
  ...mindflowConfig,
  {
    ignores: ['src/generated/**'],
  },
];
