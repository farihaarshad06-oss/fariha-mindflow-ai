import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody, Alert } from '@mindflow/ui';

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <Card>
        <CardBody>
          <Alert tone="info">{t('settings.note')}</Alert>
        </CardBody>
      </Card>
    </div>
  );
}
