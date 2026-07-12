import {
  Home,
  LayoutDashboard,
  BookOpen,
  Mic,
  MessageSquare,
  CalendarClock,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export const primaryNavItems: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/courses', labelKey: 'nav.courses', icon: BookOpen },
  { to: '/lectures', labelKey: 'nav.lectures', icon: Mic },
  { to: '/recorder', labelKey: 'nav.recorder', icon: Mic },
  { to: '/chat', labelKey: 'nav.chat', icon: MessageSquare },
  { to: '/study-plan', labelKey: 'nav.studyPlan', icon: CalendarClock },
];

export const secondaryNavItems: NavItem[] = [
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
  { to: '/privacy', labelKey: 'nav.privacy', icon: ShieldCheck },
  { to: '/', labelKey: 'nav.home', icon: Home },
];
