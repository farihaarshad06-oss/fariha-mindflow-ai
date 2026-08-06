import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewLecturePage } from '../pages/NewLecturePage';
import { SettingsPage } from '../pages/SettingsPage';
import { renderWithProviders } from './utils';

function setElectronApiMock(mock: Record<string, unknown>) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: mock,
  });
}

describe('desktop language and provider behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: undefined,
    });
  });

  it('creates desktop lectures with the preferred language instead of hardcoded English', async () => {
    const user = userEvent.setup();
    const getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { preferredLanguage: 'fa' },
    });
    const createLecture = vi.fn().mockResolvedValue({
      ok: true,
      data: { id: 'lec_123', title: 'Lecture title' },
    });

    setElectronApiMock({
      isDesktop: true,
      getSettings,
      createLecture,
    });

    renderWithProviders(<NewLecturePage />, ['/lectures/new']);

    await user.type(screen.getByLabelText('Lectures'), 'Lecture title');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createLecture).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Lecture title',
          language: 'fa',
        }),
      );
    });
  });

  it('enables an existing provider before saving the API key', async () => {
    const user = userEvent.setup();
    const upsertProvider = vi.fn().mockResolvedValue({ ok: true, data: { id: 'prov_1' } });
    const updateSettings = vi.fn().mockResolvedValue({ ok: true, data: { defaultAiProvider: 'prov_1' } });
    const setSecret = vi.fn().mockResolvedValue({ ok: true });
    const hasSecret = vi.fn().mockResolvedValue({ ok: true, data: true });

    setElectronApiMock({
      isDesktop: true,
      getSettings: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      getDiagnostics: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      listProviders: vi.fn().mockResolvedValue({
        ok: true,
        data: [{
          id: 'prov_1',
          providerType: 'openai',
          displayName: 'OpenAI',
          enabled: false,
          isDefault: false,
          baseUrl: '',
          modelRouting: '',
        }],
      }),
      upsertProvider,
      updateSettings,
      setSecret,
      hasSecret,
    });

    renderWithProviders(<SettingsPage />, ['/settings']);

    await user.type(await screen.findByLabelText('API Key'), 'sk-test');
    await user.click(screen.getByRole('button', { name: 'Save Key' }));

    await waitFor(() => {
      expect(upsertProvider).toHaveBeenCalledWith(expect.objectContaining({
        id: 'prov_1',
        providerType: 'openai',
        enabled: true,
      }));
      expect(updateSettings).toHaveBeenCalledWith({ defaultAiProvider: 'prov_1' });
      expect(setSecret).toHaveBeenCalledWith('provider.prov_1', 'sk-test');
      expect(hasSecret).toHaveBeenCalledWith('provider.prov_1');
    });
  });
});
