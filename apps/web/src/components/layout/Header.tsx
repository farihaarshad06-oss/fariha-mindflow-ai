import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, Search } from 'lucide-react';
import { NotificationIndicator } from './navigation';
import { ProfileMenu } from './ProfileMenu';
import { primaryNavItems, secondaryNavItems } from './nav-items';

const allNavItems = [...primaryNavItems, ...secondaryNavItems];

export function Header() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const currentItem = allNavItems.find((item) => pathname === item.to || pathname.startsWith(item.to + '/'));

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-2.5 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="hidden text-sm font-bold sm:block">{t('appName')}</span>
        </Link>

        {currentItem && (
          <>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="text-sm font-medium text-slate-600">{t(currentItem.labelKey)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Search"
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-100 sm:flex min-h-[36px]"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Search…</span>
          <kbd className="ms-2 hidden rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 lg:inline">
            ⌘K
          </kbd>
        </button>
        <NotificationIndicator />
        <ProfileMenu />
      </div>
    </header>
  );
}
