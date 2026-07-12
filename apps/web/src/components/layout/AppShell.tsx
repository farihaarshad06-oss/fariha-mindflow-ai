import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@mindflow/ui';
import { Header } from './Header';
import { Sidebar, BottomNav } from './navigation';

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a href="#main-content" className="skip-link rounded-lg bg-brand-600 px-3 py-2 text-white">
        {t('skipToContent')}
      </a>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pb-24 pt-6 lg:pb-10 lg:px-8"
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <Spinner label={t('common.loading')} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
