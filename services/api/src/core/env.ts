import {
  parseEnv,
  type AppEnv,
} from '@mindflow/validation';

export const env: AppEnv = parseEnv();
export type { AppEnv };

export const API_PREFIX = 'api';
