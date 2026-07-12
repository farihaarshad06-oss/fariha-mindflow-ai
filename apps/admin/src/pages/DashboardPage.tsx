import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody } from '@mindflow/ui';
import { adminUsers, adminLectures, adminJobs, adminUsage } from '../lib/mock-data';

export function DashboardPage() {
  const { t } = useTranslation();
  const stats = [
    { label: t('dashboard.totalUsers'), value: adminUsers.length },
    { label: t('dashboard.activeUsers'), value: adminUsers.filter((u) => u.status === 'ACTIVE').length },
    { label: t('dashboard.lecturesProcessed'), value: adminLectures.filter((l) => l.state === 'READY').length },
    { label: t('dashboard.failedJobs'), value: adminJobs.filter((j) => j.status === 'FAILED').length },
    { label: t('dashboard.aiUsage'), value: `${(adminUsage.aiTokens / 1000).toFixed(0)}k` },
    { label: t('dashboard.storageUsage'), value: `${(adminUsage.storageBytes / 1024 / 1024).toFixed(0)} MB` },
  ];
  return (
    <div>
      <PageHeader title={t('dashboard.title')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
