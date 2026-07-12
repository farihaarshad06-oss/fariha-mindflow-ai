import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TokenStrategy } from '@mindflow/api-client';

const TOKEN_KEY = 'mindflow.mobile.accessToken';

export class SecureTokenStorage implements TokenStrategy {
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async setTokens(accessToken: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}
