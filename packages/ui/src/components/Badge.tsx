import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-indigo-100 text-indigo-700',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertTones: Record<AlertTone, string> = {
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  role?: 'alert' | 'status';
}

export function Alert({ tone = 'info', role = 'alert', className, children, ...rest }: AlertProps) {
  return (
    <div role={role} className={cn('rounded-xl border px-4 py-3 text-sm', alertTones[tone], className)} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-block', className)}>
      <span
        aria-hidden="true"
        className="block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
      />
    </span>
  );
}
