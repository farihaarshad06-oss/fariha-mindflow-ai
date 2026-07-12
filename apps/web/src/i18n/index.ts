import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de } from './locales/de';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { fa } from './locales/fa';
import { DEFAULT_LOCALE, isRtl, isSupportedLocale } from '@mindflow/config';

function detectInitialLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const candidate = navigator.language.slice(0, 2);
    if (isSupportedLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

export const STORAGE_KEY = 'mindflow.locale';

function persistedLocale(): string {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) return stored;
  }
  return detectInitialLocale();
}

export function applyDirection(locale: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: { de, en, fr, fa },
  lng: persistedLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

applyDirection(i18n.language);

i18n.on('languageChanged', (lng) => {
  applyDirection(lng);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
