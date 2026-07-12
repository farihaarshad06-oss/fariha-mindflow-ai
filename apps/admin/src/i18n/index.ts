import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const en = {
  translation: {
    appName: 'Fariha MindFlow AI Admin',
    nav: {
      dashboard: 'Dashboard',
      users: 'Users',
      lectures: 'Lectures',
      jobs: 'Jobs',
      usage: 'Usage',
      auditLogs: 'Audit Logs',
      settings: 'Settings',
    },
    dashboard: {
      title: 'Operations Dashboard',
      totalUsers: 'Total users',
      activeUsers: 'Active users',
      lecturesProcessed: 'Lectures processed',
      failedJobs: 'Failed jobs',
      aiUsage: 'AI usage',
      storageUsage: 'Storage usage',
    },
    users: { title: 'Users', role: 'Role', status: 'Status', created: 'Created', disable: 'Disable' },
    lectures: { title: 'Lecture Processing', state: 'State', error: 'Error', retries: 'Retries', created: 'Created', updated: 'Updated' },
    jobs: { title: 'Jobs', type: 'Type', status: 'Status', retries: 'Retries', created: 'Created' },
    usage: { title: 'Usage', transcription: 'Transcription minutes', tokens: 'AI tokens', storage: 'Storage (MB)' },
    audit: { title: 'Audit Logs', actor: 'Actor', action: 'Action', resource: 'Resource', timestamp: 'Timestamp', requestId: 'Request' },
    settings: { title: 'Settings', note: 'Admin configuration placeholder.' },
    common: { noContent: 'No data available.' },
  },
};

const de = {
  translation: {
    appName: 'Fariha MindFlow AI Admin',
    nav: {
      dashboard: 'Übersicht',
      users: 'Benutzer',
      lectures: 'Vorlesungen',
      jobs: 'Aufträge',
      usage: 'Nutzung',
      auditLogs: 'Audit-Protokolle',
      settings: 'Einstellungen',
    },
    dashboard: {
      title: 'Betriebsübersicht',
      totalUsers: 'Benutzer gesamt',
      activeUsers: 'Aktive Benutzer',
      lecturesProcessed: 'Verarbeitete Vorlesungen',
      failedJobs: 'Fehlgeschlagene Aufträge',
      aiUsage: 'KI-Nutzung',
      storageUsage: 'Speichernutzung',
    },
    users: { title: 'Benutzer', role: 'Rolle', status: 'Status', created: 'Erstellt', disable: 'Deaktivieren' },
    lectures: { title: 'Vorlesungsverarbeitung', state: 'Status', error: 'Fehler', retries: 'Versuche', created: 'Erstellt', updated: 'Aktualisiert' },
    jobs: { title: 'Aufträge', type: 'Typ', status: 'Status', retries: 'Versuche', created: 'Erstellt' },
    usage: { title: 'Nutzung', transcription: 'Transkriptionsminuten', tokens: 'KI-Tokens', storage: 'Speicher (MB)' },
    audit: { title: 'Audit-Protokolle', actor: 'Akteur', action: 'Aktion', resource: 'Ressource', timestamp: 'Zeitstempel', requestId: 'Anfrage' },
    settings: { title: 'Einstellungen', note: 'Platzhalter für Admin-Konfiguration.' },
    common: { noContent: 'Keine Daten verfügbar.' },
  },
};

void i18n.use(initReactI18next).init({
  resources: { en, de },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
