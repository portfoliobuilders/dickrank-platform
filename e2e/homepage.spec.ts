import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays hero section', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('DickRank');
    await expect(page.locator('text=Discover')).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.click('text=Explore');
    await expect(page).toHaveURL('/explore');
  });

  test('search functionality', async ({ page }) => {
    await page.fill('[placeholder="Search..."]', 'upward curve');
    await page.press('[placeholder="Search..."]', 'Enter');
    await expect(page).toHaveURL(/.*search.*/);
  });

  test('requires age verification for adult content', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/verify-age');
  });

  test('mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('nav')).toBeVisible();
    
    // Check hamburger menu exists
    await expect(page.locator('[aria-label="Menu"]')).toBeVisible();
  });
});

test.describe('Authentication', () => {
  test('user can register', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.fill('[name="confirmPassword"]', 'SecurePass123!');
    await page.check('[name="ageConfirm"]');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/verify-age');
  });

  test('shows error for existing email', async ({ page }) => {
    await page.goto('/register');
    // ... fill form with existing email
    await page.click('button[type="submit"]');
    await expect(page.locator('text=already exists')).toBeVisible();
  });
});
