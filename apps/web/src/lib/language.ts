export function normalizeLanguageCode(language?: string): string {
  const code = language?.trim().slice(0, 2).toLowerCase();
  return code && /^[a-z]{2}$/.test(code) ? code : 'en';
}
