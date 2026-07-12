import { test, expect } from '@playwright/test';

test('web smoke: landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/AI Learning Companion/i)).toBeVisible();
});
