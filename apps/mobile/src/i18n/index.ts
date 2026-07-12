import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_LABELS } from '@mindflow/config';

const resources = {
  de: { translation: { appName: 'Fariha MindFlow AI', login: 'Anmelden', dashboard: 'Übersicht', recorder: 'Aufnahme' } },
  en: { translation: { appName: 'Fariha MindFlow AI', login: 'Sign in', dashboard: 'Dashboard', recorder: 'Recorder' } },
  fr: { translation: { appName: 'Fariha MindFlow AI', login: 'Connexion', dashboard: 'Tableau de bord', recorder: 'Enregistreur' } },
  fa: { translation: { appName: 'فاریحا مایندفلو AI', login: 'ورود', dashboard: 'پیشخوان', recorder: 'ضبط‌کننده' } },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: { escapeValue: false },
});

export { LOCALE_LABELS };
export default i18n;
