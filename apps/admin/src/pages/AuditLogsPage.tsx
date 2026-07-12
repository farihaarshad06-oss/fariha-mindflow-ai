import { useTranslation } from 'react-i18next';
import { PageHeader } from '@mindflow/ui';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { adminAuditLogs } from '../lib/mock-data';

export function AuditLogsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('audit.title')} />
      <ResponsiveTable
        rows={adminAuditLogs}
        columns={[
          { key: 'actor', header: t('audit.actor'), render: (a) => a.actorId ?? a.actorType },
          { key: 'action', header: t('audit.action'), render: (a) => a.action },
          { key: 'resource', header: t('audit.resource'), render: (a) => a.resource },
          { key: 'requestId', header: t('audit.requestId'), render: (a) => a.requestId ?? '—' },
          { key: 'timestamp', header: t('audit.timestamp'), render: (a) => new Date(a.createdAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
