import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, Button, Alert, Select, Input, Spinner } from '@mindflow/ui';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@mindflow/config';
import { useAuthStore } from '../store/auth';
import {
  Shield, Key, Database, Brain, User, Globe, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface DesktopProvider {
  id: string;
  providerType: string;
  displayName: string;
  enabled: boolean;
  isDefault: boolean;
  baseUrl?: string | null;
  modelRouting?: string | null;
}

function parseModelRouting(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as { economy?: string; balanced?: string; quality?: string };
  } catch {
    return undefined;
  }
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

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    const load = async () => {
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.getSettings();
        if (res.ok && res.data) setSettings(res.data as DesktopSettings);
        const diagRes = await window.electronAPI.getDiagnostics();
        if (diagRes.ok) setDiagnostics(diagRes.data as Record<string, unknown>);
      }
      setLoading(false);
    };
    void load();
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
    const providers = providersRes.ok && Array.isArray(providersRes.data) ? providersRes.data as DesktopProvider[] : [];
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
      matchingProvider = {
        id: created.id,
        providerType: apiKeyProvider,
        displayName: displayNames[apiKeyProvider] ?? apiKeyProvider,
        enabled: true,
        isDefault: providers.length === 0,
      };
    } else if (!matchingProvider.enabled) {
      const upsertRes = await window.electronAPI.upsertProvider({
        id: matchingProvider.id,
        providerType: matchingProvider.providerType,
        displayName: matchingProvider.displayName,
        enabled: true,
        isDefault: matchingProvider.isDefault,
        baseUrl: matchingProvider.baseUrl ?? '',
        modelRouting: parseModelRouting(matchingProvider.modelRouting),
      });
      if (!upsertRes.ok) {
        setKeyStatus('error');
        setKeyErrorMessage(`Failed to enable provider: ${upsertRes.error ?? 'Unknown error'}`);
        setTimeout(() => { setKeyStatus('idle'); setKeyErrorMessage(null); }, 5000);
        return;
      }
      matchingProvider = { ...matchingProvider, enabled: true };
    }

    const settingsRes = await window.electronAPI.updateSettings({
      defaultAiProvider: matchingProvider.id,
    });
    if (!settingsRes.ok) {
      setKeyStatus('error');
      setKeyErrorMessage(`Failed to update AI settings: ${settingsRes.error ?? 'Unknown error'}`);
      setTimeout(() => { setKeyStatus('idle'); setKeyErrorMessage(null); }, 5000);
      return;
    }

    const res = await window.electronAPI.setSecret(`provider.${matchingProvider.id}`, apiKey);
    if (res.ok) {
      const verifyRes = await window.electronAPI.hasSecret(`provider.${matchingProvider.id}`);
      if (verifyRes.ok && verifyRes.data === true) {
        setKeyStatus('saved');
        setApiKey('');
      } else {
        setKeyStatus('error');
        setKeyErrorMessage('Key was not persisted. Please try again.');
        setTimeout(() => { setKeyStatus('idle'); setKeyErrorMessage(null); }, 5000);
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
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Settings className="h-5 w-5 text-brand-600" aria-hidden="true" />
          {t('settings.title')}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage your account, preferences, and AI configuration.</p>
      </div>

      {/* Saved toast */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 border border-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Settings saved
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{t('settings.account')}</p>
              <p className="text-sm text-slate-500">{user?.email ?? (isDesktop ? 'Local user' : '—')}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* General: Language */}
      <Card>
        <CardBody>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900">{t('settings.language')}</h2>
          </div>
          <Select
            aria-label={t('settings.language')}
            value={settings.preferredLanguage ?? i18n.language}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value);
              void save({ preferredLanguage: e.target.value });
            }}
            className="max-w-xs"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Privacy */}
      <Card>
        <CardBody>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900">{t('settings.privacy')}</h2>
          </div>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('settings.recordingConsent')}</p>
                <p className="text-xs text-slate-400">Allow the app to record and process audio.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.recordingConsentGiven ?? false}
                onChange={(e) => void save({ recordingConsentGiven: e.target.checked })}
                className="h-4 w-4 accent-brand-600"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">Privacy mode by default</p>
                <p className="text-xs text-slate-400">Skip auto-transcription when starting a recording.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacyModeDefault ?? false}
                onChange={(e) => void save({ privacyModeDefault: e.target.checked })}
                className="h-4 w-4 accent-brand-600"
              />
            </label>
            <div className="pt-1">
              <Input
                label={t('settings.audioRetention')}
                type="number"
                min={1}
                max={3650}
                value={String(settings.audioRetentionDays ?? 90)}
                onChange={(e) => void save({ audioRetentionDays: parseInt(e.target.value, 10) })}
                className="max-w-xs"
              />
              <p className="mt-1 text-xs text-slate-400">Days to keep recorded audio files on disk.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Provider API Keys */}
      {isDesktop && (
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center gap-2">
              <Key className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <h2 className="font-semibold text-slate-900">AI Provider</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Keys are encrypted with your OS credential store and never stored in plain text.
            </p>
            <div className="flex flex-col gap-3">
              <Select
                label="Provider"
                value={apiKeyProvider}
                onChange={(e) => setApiKeyProvider(e.target.value)}
                className="max-w-xs"
              >
                <option value="openai">OpenAI</option>
                <option value="azure">Azure OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="ollama">Ollama (no key needed)</option>
                <option value="lmstudio">LM Studio (no key needed)</option>
              </Select>
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
                    Save Key
                  </Button>
                </div>
              )}
              {keyStatus === 'saved' && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Key saved securely.
                </div>
              )}
              {keyStatus === 'error' && (
                <Alert tone="danger">{keyErrorMessage ?? 'Failed to save key. OS encryption may be unavailable.'}</Alert>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Advanced (collapsed by default) */}
      {isDesktop && (
        <AdvancedSection settings={settings} save={save} diagnostics={diagnostics} />
      )}

      {saving && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Saving…
        </p>
      )}
    </div>
  );
}

// Advanced settings hidden from average users
function AdvancedSection({
  settings,
  save,
  diagnostics,
}: {
  settings: DesktopSettings;
  save: (updates: Partial<DesktopSettings>) => Promise<void>;
  diagnostics: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardBody>
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="font-semibold text-slate-700">Advanced</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <p className="text-sm font-medium text-slate-700">AI Usage Limits</p>
                  </div>
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
                      label="Daily cost limit (¢)"
                      type="number"
                      value={String(settings.dailyCostLimitCents ?? 500)}
                      onChange={(e) => void save({ dailyCostLimitCents: parseInt(e.target.value, 10) })}
                    />
                    <Input
                      label="Monthly cost limit (¢)"
                      type="number"
                      value={String(settings.monthlyCostLimitCents ?? 5000)}
                      onChange={(e) => void save({ monthlyCostLimitCents: parseInt(e.target.value, 10) })}
                    />
                  </div>
                </div>

                {diagnostics && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">Diagnostics</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      {Object.entries(diagnostics).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="font-medium">{k}</dt>
                          <dd className="truncate text-slate-500">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardBody>
    </Card>
  );
}
