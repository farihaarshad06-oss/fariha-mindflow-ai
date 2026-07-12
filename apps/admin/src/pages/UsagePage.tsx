import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody } from '@mindflow/ui';
import { adminUsage } from '../lib/mock-data';

export function UsagePage() {
  const { t } = useTranslation();
  const cards = [
    { label: t('usage.transcription'), value: `${adminUsage.transcriptionMinutes} min` },
    { label: t('usage.tokens'), value: adminUsage.aiTokens.toLocaleString() },
    { label: t('usage.storage'), value: `${(adminUsage.storageBytes / 1024 / 1024).toFixed(0)} MB` },
  ];
  return (
    <div>
      <PageHeader title={t('usage.title')} />
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardBody>
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className="text-xl font-semibold text-slate-900">{card.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
