import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

export function ProfileMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 min-h-[44px] min-w-[44px]"
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <div className="px-3 py-2 text-sm text-slate-700">
            <p className="font-semibold">{user?.fullName ?? 'Guest'}</p>
            <p className="text-xs text-slate-500">{user?.email ?? ''}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
          >
            <UserIcon className="h-4 w-4" aria-hidden="true" /> {t('nav.settings')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
