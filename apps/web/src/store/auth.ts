import { create } from 'zustand';
import type { User } from '@mindflow/types';
import { apiClient } from '../lib/api';
import { tokenStrategy } from '../lib/api';

interface AuthState {
  user: User | null;
  initialized: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    const result = await apiClient.post<{ user: User; tokens: { accessToken: string } }>(
      '/auth/login',
      { email, password },
    );
    tokenStrategy.setTokens(result.tokens.accessToken);
    set({ user: result.user });
  },
  register: async (input) => {
    const result = await apiClient.post<{ user: User; tokens: { accessToken: string } }>(
      '/auth/register',
      input,
    );
    tokenStrategy.setTokens(result.tokens.accessToken);
    set({ user: result.user });
  },
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      tokenStrategy.clear();
      set({ user: null });
    }
  },
}));
