import { expect, test } from '@playwright/test';

test('home page names the site', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DickRank/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creator payments');
});
