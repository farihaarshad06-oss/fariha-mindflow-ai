import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { DashboardPage } from '../pages/DashboardPage';
import { renderWithProviders } from './utils';

describe('DashboardPage', () => {
  it('renders the dashboard with content', () => {
    renderWithProviders(<DashboardPage view="data" />, ['/dashboard']);
    expect(screen.getByRole('heading', { level: 1, name: /Recent lectures/i })).toBeInTheDocument();
  });

  it('renders a loading state', () => {
    renderWithProviders(<DashboardPage view="loading" />, ['/dashboard']);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders an empty state when there are no lectures', () => {
    renderWithProviders(<DashboardPage view="empty" />, ['/dashboard']);
    expect(screen.getByText('No lectures yet. Start your first recording!')).toBeInTheDocument();
  });
});
