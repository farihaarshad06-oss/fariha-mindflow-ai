import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody, Button, Alert, Select, Input, Spinner } from '@mindflow/ui';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@mindflow/config';
import { useAuthStore } from '../store/auth';
import { Shield, Key, Database, Brain } from 'lucide-react';

interface DesktopSettings {
  preferredLanguage?: string;
  theme?: string;
  audioRetentionDays?: number;
  recordingConsentGiven?: boolean;
  onboardingComplete?: boolean;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyCostLimitCents?: number;
  monthlyCostLimitCents?: number;
  aiMode?: string;
  privacyModeDefault?: boolean;
  whisperModelId?: string;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [settings, setSettings] = useState<DesktopSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyProvider, setApiKeyProvider] = useState('openai');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  // Maps providerType → true when a key is already stored in the vault.
  const [savedProviderKeys, setSavedProviderKeys] = useState<Record<string, boolean>>({});

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  // Refresh the "key already set" indicators for all known providers.
  const refreshSavedKeys = async () => {
    if (!isDesktop || !window.electronAPI) return;
    const providersRes = await window.electronAPI.listProviders();
    if (!providersRes.ok || !Array.isArray(providersRes.data)) return;
    const providers = providersRes.data as Array<{ id: string; providerType: string }>;
    const map: Record<string, boolean> = {};
    await Promise.all(
      providers.map(async (p) => {
        const res = await window.electronAPI!.hasSecret(`provider.${p.id}`);
        map[p.providerType] = !!(res.ok && res.data);
      }),
    );
    setSavedProviderKeys(map);
  };

  useEffect(() => {
    const load = async () => {
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.getSettings();
        if (res.ok && res.data) setSettings(res.data as DesktopSettings);
        const diagRes = await window.electronAPI.getDiagnostics();
        if (diagRes.ok) setDiagnostics(diagRes.data as Record<string, unknown>);
        // Load existing key indicators so the user can see which providers are configured.
        await refreshSavedKeys();
      }
      setLoading(false);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  const save = async (updates: Partial<DesktopSettings>) => {
    setSaving(true);
    const merged = { ...settings, ...updates };
    setSettings(merged);
    if (isDesktop && window.electronAPI) {
      await window.electronAPI.updateSettings(updates as Record<string, unknown>);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [keyErrorMessage, setKeyErrorMessage] = useState<string | null>(null);

  const saveApiKey = async () => {
    if (!apiKey.trim() || !isDesktop || !window.electronAPI) return;
    setKeyErrorMessage(null);

    const providersRes = await window.electronAPI.listProviders();
    const providers = providersRes.ok && Array.isArray(providersRes.data) ? providersRes.data as Array<{ id: string; providerType: string }> : [];
    let matchingProvider = providers.find((provider) => provider.providerType === apiKeyProvider);

    // Auto-create the provider record if it doesn't exist yet so the user
    // can save a key without having to manually configure providers first.
    if (!matchingProvider) {
      const displayNames: Record<string, string> = {
        openai: 'OpenAI',
        azure: 'Azure OpenAI',
        gemini: 'Google Gemini',
        ollama: 'Ollama',
        lmstudio: 'LM Studio',
      };
      const upsertRes = await window.electronAPI.upsertProvider({
        providerType: apiKeyProvider,
        displayName: displayNames[apiKeyProvider] ?? apiKeyProvider,
        enabled: true,
        isDefault: providers.length === 0, // first provider becomes default
      });
      if (!upsertRes.ok || !upsertRes.data) {
        setKeyStatus('error');
        setKeyErrorMessage(`Failed to create provider: ${upsertRes.error ?? 'Unknown error'}`);
        setTimeout(() => { setKeyStatus('idle'); setKeyErrorMessage(null); }, 5000);
        return;
      }
      const created = upsertRes.data as { id: string };
      matchingProvider = { id: created.id, providerType: apiKeyProvider };
    }

    await window.electronAPI.updateSettings({
      defaultAiProvider: matchingProvider.id,
    });

    const res = await window.electronAPI.setSecret(`provider.${matchingProvider.id}`, apiKey);
    if (res.ok) {
      // Immediately verify the key was actually persisted to the vault.
      const verifyRes = await window.electronAPI.hasSecret(`provider.${matchingProvider.id}`);
      if (verifyRes.ok && verifyRes.data) {
        setKeyStatus('saved');
        setApiKey('');
        // Refresh all provider key indicators so the UI reflects the new state.
        await refreshSavedKeys();
      } else {
        setKeyStatus('error');
        setKeyErrorMessage('Key was not persisted. OS encryption may be unavailable.');
      }
    } else {
      setKeyStatus('error');
      setKeyErrorMessage(`Failed to save key: ${res.error ?? 'OS encryption may be unavailable.'}`);
      setTimeout(() => setKeyErrorMessage(null), 5000);
    }
    setTimeout(() => setKeyStatus('idle'), 3000);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner label={t('common.loading')} /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('settings.title')} />

      {/* Account */}
      <Card className="mb-4">
        <CardBody>
          <h2 className="font-semibold text-slate-900">{t('settings.account')}</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.email ?? (isDesktop ? 'Local user' : '—')}</p>
        </CardBody>
      </Card>

      {/* Language */}
      <Card className="mb-4">
        <CardBody>
          <h2 className="font-semibold text-slate-900">{t('settings.language')}</h2>
          <Select
            aria-label={t('settings.language')}
            value={settings.preferredLanguage ?? i18n.language}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value);
              void save({ preferredLanguage: e.target.value });
            }}
            className="mt-2 max-w-xs"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Privacy */}
      <Card className="mb-4">
        <CardBody>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {t('settings.privacy')}
          </h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={settings.recordingConsentGiven ?? false}
              onChange={(e) => void save({ recordingConsentGiven: e.target.checked })}
            />
            {t('settings.recordingConsent')}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={settings.privacyModeDefault ?? false}
              onChange={(e) => void save({ privacyModeDefault: e.target.checked })}
            />
            Privacy mode by default (skip auto-transcription)
          </label>
          <Input
            label={t('settings.audioRetention')}
            type="number"
            min={1}
            max={3650}
            value={String(settings.audioRetentionDays ?? 90)}
            onChange={(e) => void save({ audioRetentionDays: parseInt(e.target.value, 10) })}
            className="mt-3 max-w-xs"
          />
        </CardBody>
      </Card>

      {/* AI Provider API Keys */}
      {isDesktop && (
        <Card className="mb-4">
          <CardBody>
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <Key className="h-4 w-4 text-brand-600" aria-hidden="true" />
              AI Provider API Keys
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Keys are encrypted with OS credential store. Never stored in plain text or sent to logs.
            </p>
            <div className="flex flex-col gap-3">
              <Select
                label="Provider"
                value={apiKeyProvider}
                onChange={(e) => setApiKeyProvider(e.target.value)}
                className="max-w-xs"
              >
                <option value="openai">OpenAI{savedProviderKeys['openai'] ? ' ✓' : ''}</option>
                <option value="azure">Azure OpenAI{savedProviderKeys['azure'] ? ' ✓' : ''}</option>
                <option value="gemini">Google Gemini{savedProviderKeys['gemini'] ? ' ✓' : ''}</option>
                <option value="ollama">Ollama (no key needed)</option>
                <option value="lmstudio">LM Studio (no key needed)</option>
              </Select>
              {savedProviderKeys[apiKeyProvider] && !['ollama', 'lmstudio'].includes(apiKeyProvider) && (
                <p className="text-xs text-emerald-600">✓ A key is already saved for this provider. Enter a new key below to replace it.</p>
              )}
              {!['ollama', 'lmstudio'].includes(apiKeyProvider) && (
                <div className="flex gap-2">
                  <Input
                    label="API Key"
                    type="password"
                    placeholder="sk-…"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={() => void saveApiKey()} disabled={!apiKey.trim()} className="self-end">
                    Save
                  </Button>
                </div>
              )}
              {keyStatus === 'saved' && <Alert tone="success">Key saved and verified.</Alert>}
              {keyStatus === 'error' && <Alert tone="danger">{keyErrorMessage ?? 'Failed to save key. OS encryption may be unavailable.'}</Alert>}
            </div>
          </CardBody>
        </Card>
      )}

      {/* AI Usage Limits */}
      {isDesktop && (
        <Card className="mb-4">
          <CardBody>
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <Brain className="h-4 w-4 text-brand-600" aria-hidden="true" />
              AI Usage Limits
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Daily token limit"
                type="number"
                value={String(settings.dailyTokenLimit ?? 50000)}
                onChange={(e) => void save({ dailyTokenLimit: parseInt(e.target.value, 10) })}
              />
              <Input
                label="Monthly token limit"
                type="number"
                value={String(settings.monthlyTokenLimit ?? 500000)}
                onChange={(e) => void save({ monthlyTokenLimit: parseInt(e.target.value, 10) })}
              />
              <Input
                label="Daily cost limit (cents)"
                type="number"
                value={String(settings.dailyCostLimitCents ?? 500)}
                onChange={(e) => void save({ dailyCostLimitCents: parseInt(e.target.value, 10) })}
              />
              <Input
                label="Monthly cost limit (cents)"
                type="number"
                value={String(settings.monthlyCostLimitCents ?? 5000)}
                onChange={(e) => void save({ monthlyCostLimitCents: parseInt(e.target.value, 10) })}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Diagnostics */}
      {isDesktop && diagnostics && (
        <Card className="mb-4">
          <CardBody>
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
              <Database className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Diagnostics
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              {Object.entries(diagnostics).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium">{k}</dt>
                  <dd className="truncate text-slate-500">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}

      {saving && <p className="text-xs text-slate-400">Saving…</p>}
      {saved && <Alert tone="success">Settings saved.</Alert>}
    </div>
  );
}
