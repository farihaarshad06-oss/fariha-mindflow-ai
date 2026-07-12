import { ApiClient } from '@mindflow/api-client';
import { SecureTokenStorage } from './token-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export const tokenStorage = new SecureTokenStorage();

export const mobileApiClient = new ApiClient({
  baseUrl: API_URL,
  tokenStrategy: tokenStorage,
});
