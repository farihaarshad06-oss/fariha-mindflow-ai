import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { renderWithProviders } from './utils';

describe('Navigation', () => {
  it('navigates from the landing page to the recorder', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, ['/']);
    await user.click(screen.getByRole('link', { name: /record lecture/i }));
    expect(await screen.findByRole('heading', { name: 'Recorder' })).toBeInTheDocument();
  });
});
