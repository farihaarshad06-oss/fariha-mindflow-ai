import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody, Button, Alert, Select, Input } from '@mindflow/ui';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@mindflow/config';
import { useAuthStore } from '../store/auth';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [exported, setExported] = useState(false);
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('settings.title')} />

      <Card className="mb-4">
        <CardBody>
          <h2 className="font-semibold text-slate-900">{t('settings.account')}</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.email ?? '—'}</p>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody>
          <h2 className="font-semibold text-slate-900">{t('settings.language')}</h2>
          <Select
            aria-label={t('settings.language')}
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="mt-2 max-w-xs"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_LABELS[locale]}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody>
          <h2 className="font-semibold text-slate-900">{t('settings.privacy')}</h2>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" defaultChecked /> {t('settings.recordingConsent')}
          </label>
          <Input
            label={t('settings.audioRetention')}
            defaultValue="90"
            className="mt-3 max-w-xs"
          />
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">{t('settings.export')}</h2>
            <p className="text-sm text-slate-500">GDPR / FADP data export</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setExported(true);
              window.setTimeout(() => setExported(false), 2500);
            }}
          >
            {t('settings.export')}
          </Button>
        </CardBody>
      </Card>

      {exported && <Alert tone="success">{t('settings.export')} …</Alert>}

      <Card>
        <CardBody className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-red-700">{t('settings.deleteAccount')}</h2>
            <p className="text-sm text-slate-500">Irreversible</p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              setDeleted(true);
              window.setTimeout(() => setDeleted(false), 2500);
            }}
          >
            {t('settings.deleteAccount')}
          </Button>
        </CardBody>
      </Card>

      {deleted && <Alert tone="danger">{t('settings.deleteAccount')} — requested</Alert>}
    </div>
  );
}
