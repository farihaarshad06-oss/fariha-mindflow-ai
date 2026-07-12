import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../i18n';
import { SUPPORTED_LOCALES } from '@mindflow/config';

describe('Localization direction', () => {
  afterEach(() => {
    void i18n.changeLanguage('de');
  });

  it('switches document direction to RTL for Dari/Persian', async () => {
    await i18n.changeLanguage('fa');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('fa');
  });

  it('keeps LTR for German, English and French', async () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== 'fa')) {
      await i18n.changeLanguage(locale);
      expect(document.documentElement.dir).toBe('ltr');
    }
  });
});
