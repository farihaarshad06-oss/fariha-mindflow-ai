import { test, expect } from '@playwright/test';

test('recorder requires explicit consent before recording', async ({ page }) => {
  await page.goto('/recorder');
  const recordButton = page.getByTestId('record-button');
  await expect(recordButton).toBeDisabled();
  await expect(page.getByTestId('consent-notice')).toBeVisible();

  await page.getByTestId('consent-checkbox').check();
  await expect(recordButton).toBeEnabled();
});
