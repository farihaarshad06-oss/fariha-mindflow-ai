import { test, expect } from '@playwright/test';

test('dashboard navigation from landing page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /record lecture/i }).click();
  await expect(page.getByRole('heading', { name: 'Recorder' })).toBeVisible();
});

test('navigating to courses', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
