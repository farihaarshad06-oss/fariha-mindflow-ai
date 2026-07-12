import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrainCircuit } from 'lucide-react';
import { NotificationIndicator } from './navigation';
import { ProfileMenu } from './ProfileMenu';

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
      <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <BrainCircuit className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-sm sm:text-base">{t('appName')}</span>
      </Link>
      <div className="flex items-center gap-2">
        <NotificationIndicator />
        <ProfileMenu />
      </div>
    </header>
  );
}
