import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecorderPage } from '../pages/RecorderPage';
import { renderWithProviders } from './utils';

describe('RecorderPage consent', () => {
  it('keeps the record button disabled until consent is given', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecorderPage />, ['/recorder']);

    expect(screen.getByTestId('consent-notice')).toBeInTheDocument();
    const recordButton = screen.getByTestId('record-button') as HTMLButtonElement;
    expect(recordButton.disabled).toBe(true);

    await user.click(screen.getByTestId('consent-checkbox'));
    expect((screen.getByTestId('record-button') as HTMLButtonElement).disabled).toBe(false);
  });
});
