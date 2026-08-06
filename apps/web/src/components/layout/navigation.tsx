import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { primaryNavItems, secondaryNavItems, type NavItem } from './nav-items';

function NavList({ items, label }: { items: NavItem[]; label: string }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-0.5" aria-label={label}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            title={t(item.labelKey)}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                'transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl bg-brand-50"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
                <span className="relative">{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-e border-slate-200/80 bg-white/95 px-3 py-5 lg:block">
      <div className="flex h-full flex-col gap-1">
        <NavList items={primaryNavItems} label="Primary" />
        <div className="mt-auto border-t border-slate-100 pt-3">
          <NavList items={secondaryNavItems} label="Secondary" />
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
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150',
                isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span className={`relative flex items-center justify-center rounded-lg p-1 transition-colors ${isActive ? 'bg-brand-50' : ''}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

const mockNotifications = [
  { id: '1', title: 'Transcription complete', body: '"Principles of Bioethics" is ready.', time: '2m ago', read: false },
  { id: '2', title: 'Study streak', body: '5-day streak! Keep it up 🔥', time: '1h ago', read: false },
  { id: '3', title: 'AI Insight', body: 'New weak topics detected in Data Structures.', time: '3h ago', read: true },
];

export function NotificationIndicator() {
  const [open, setOpen] = useState(false);
  const unread = mockNotifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute end-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute end-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold text-slate-900">Notifications</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="divide-y divide-slate-50">
                {mockNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 ${!n.read ? 'bg-brand-50/40' : ''}`}
                  >
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                    {n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{n.title}</p>
                      <p className="text-slate-500">{n.body}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-2.5">
                <button type="button" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  Mark all as read
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
