import type { TokenStrategy } from '@mindflow/api-client';

const TOKEN_KEY = 'mindflow.accessToken';

export class BrowserTokenStrategy implements TokenStrategy {
  getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setTokens(accessToken: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
  }

  clear(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  }
}
