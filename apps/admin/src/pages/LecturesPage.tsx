import { useTranslation } from 'react-i18next';
import { PageHeader, Badge } from '@mindflow/ui';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { adminLectures } from '../lib/mock-data';

export function LecturesPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('lectures.title')} />
      <ResponsiveTable
        rows={adminLectures}
        columns={[
          { key: 'title', header: 'Title', render: (l) => l.title },
          { key: 'state', header: t('lectures.state'), render: (l) => <Badge tone={l.state === 'READY' ? 'success' : 'info'}>{l.state}</Badge> },
          { key: 'created', header: t('lectures.created'), render: (l) => new Date(l.createdAt).toLocaleString() },
          { key: 'updated', header: t('lectures.updated'), render: (l) => new Date(l.updatedAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
