import { useTranslation } from 'react-i18next';
import { PageHeader, Badge } from '@mindflow/ui';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { adminJobs } from '../lib/mock-data';

export function JobsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('jobs.title')} />
      <ResponsiveTable
        rows={adminJobs}
        columns={[
          { key: 'type', header: t('jobs.type'), render: (j) => j.jobType },
          { key: 'status', header: t('jobs.status'), render: (j) => <Badge tone={j.status === 'FAILED' ? 'danger' : j.status === 'SUCCEEDED' ? 'success' : 'info'}>{j.status}</Badge> },
          { key: 'retries', header: t('jobs.retries'), render: (j) => `${j.retryCount}/${j.maxRetries}` },
          { key: 'error', header: t('lectures.error'), render: (j) => j.safeErrorMessage ?? '—' },
          { key: 'created', header: t('jobs.retries'), render: (j) => new Date(j.createdAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
