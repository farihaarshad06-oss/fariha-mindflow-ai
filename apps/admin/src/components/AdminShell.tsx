import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  Mic,
  ListChecks,
  BarChart3,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_ROUTES } from '@mindflow/config';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { to: ADMIN_ROUTES.dashboard, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: ADMIN_ROUTES.users, labelKey: 'nav.users', icon: Users },
  { to: ADMIN_ROUTES.lectures, labelKey: 'nav.lectures', icon: Mic },
  { to: ADMIN_ROUTES.jobs, labelKey: 'nav.jobs', icon: ListChecks },
  { to: ADMIN_ROUTES.usage, labelKey: 'nav.usage', icon: BarChart3 },
  { to: ADMIN_ROUTES.auditLogs, labelKey: 'nav.auditLogs', icon: ScrollText },
  { to: ADMIN_ROUTES.settings, labelKey: 'nav.settings', icon: Settings },
];

export function AdminShell() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#admin-main" className="sr-only focus:not-sr-only rounded bg-brand-600 px-3 py-2 text-white">
        Skip to content
      </a>
      <aside className="border-b border-slate-200 bg-white px-3 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-e">
        <p className="mb-4 px-2 text-sm font-semibold text-slate-900">{t('appName')}</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap min-h-[44px]',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(item.labelKey)}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main id="admin-main" className="flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
