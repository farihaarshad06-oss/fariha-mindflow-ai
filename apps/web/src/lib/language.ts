// Recorder IPC currently validates two-letter language codes, so locale tags
// like "fa-IR" are intentionally reduced to "fa" before use.
export function normalizeLanguageCode(language?: string): string {
  const code = language?.trim().slice(0, 2).toLowerCase();
  return code && /^[a-z]{2}$/.test(code) ? code : 'en';
}
