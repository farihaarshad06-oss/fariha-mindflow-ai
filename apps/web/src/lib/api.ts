import { ApiClient, InMemoryTokenStrategy } from '@mindflow/api-client';
import { BrowserTokenStrategy } from './token-strategy';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api';

export const tokenStrategy = new BrowserTokenStrategy();

export const apiClient = new ApiClient({
  baseUrl: API_URL,
  tokenStrategy,
  generateRequestId: () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}`,
});

export const anonymousClient = new ApiClient({
  baseUrl: API_URL,
  tokenStrategy: new InMemoryTokenStrategy(),
});
