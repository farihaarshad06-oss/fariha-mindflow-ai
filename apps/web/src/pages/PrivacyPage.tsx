import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { PageHeader, Card, CardBody, Alert } from '@mindflow/ui';

export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('privacy.title')} />
      <Alert tone="info" className="mb-4">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('privacy.consent')}
        </span>
      </Alert>
      <Card>
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">{t('privacy.intro')}</p>
          <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-slate-600">
            <li>{t('privacy.consent')}</li>
            <li>Swiss FADP &amp; GDPR aligned retention controls.</li>
            <li>Recordings are never used to train AI models by default.</li>
            <li>Encryption in transit and managed encryption at rest.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
