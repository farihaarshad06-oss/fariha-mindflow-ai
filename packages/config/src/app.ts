export const APP_NAME = 'Fariha MindFlow AI';
export const APP_TAGLINE = 'Your Personal AI Learning Companion';
export const API_VERSION = '0.1.0';
export const API_PREFIX = 'api';

export const COOKIE_DOMAIN_DEFAULT = 'localhost';

export const FEATURE_FLAGS = {
  voiceTutor: false,
  ragSearch: true,
  mobileApp: false,
  auditLogExport: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
