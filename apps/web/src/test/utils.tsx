import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('@mindflow/api-client', () => {
  const noop = () => Promise.resolve({});
  return {
    ApiClient: class {
      get = noop;
      post = noop;
      patch = noop;
      delete = noop;
    },
    InMemoryTokenStrategy: class {
      getAccessToken() {
        return null;
      }
      setTokens() {}
      clear() {}
    },
  };
});

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
