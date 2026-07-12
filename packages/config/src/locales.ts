export const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'fa'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

export const RTL_LOCALES: Locale[] = ['fa'];

export const LOCALE_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  fa: 'دری / فارسی',
};

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
