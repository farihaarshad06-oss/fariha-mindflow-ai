import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { primaryNavItems, secondaryNavItems, type NavItem } from './nav-items';

function NavList({ items }: { items: NavItem[] }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                'min-h-[44px]',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-e border-slate-200 bg-white px-3 py-4 lg:block">
      <div className="flex flex-col gap-6">
        <NavList items={primaryNavItems} />
        <div className="border-t border-slate-100 pt-4">
          <NavList items={secondaryNavItems} />
        </div>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const items = [...primaryNavItems, ...secondaryNavItems].slice(0, 5);
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white lg:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-700' : 'text-slate-500',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function NotificationIndicator() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 min-h-[44px] min-w-[44px]"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />
    </button>
  );
}
