import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../pages/DashboardPage';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Admin dashboard', () => {
  it('renders the operations dashboard', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total users')).toBeInTheDocument();
  });
});
