import { useTranslation } from 'react-i18next';
import { PageHeader, Badge, Button } from '@mindflow/ui';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { adminUsers } from '../lib/mock-data';

export function UsersPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('users.title')} />
      <ResponsiveTable
        rows={adminUsers}
        columns={[
          { key: 'email', header: 'Email', render: (u) => u.email },
          { key: 'role', header: t('users.role'), render: (u) => u.roles.join(', ') },
          { key: 'status', header: t('users.status'), render: (u) => <Badge tone={u.status === 'ACTIVE' ? 'success' : 'neutral'}>{u.status}</Badge> },
          { key: 'created', header: t('users.created'), render: (u) => new Date(u.createdAt).toLocaleDateString() },
          {
            key: 'actions',
            header: '',
            render: () => (
              <Button variant="ghost" disabled>
                {t('users.disable')}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
