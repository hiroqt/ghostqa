import { expect, test } from '@playwright/test';

test('seeded registration failure is replayed and reported with evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete', { timeout: 60_000 });
  await expect(page.getByText('verified', { exact: true })).toBeVisible();
  await expect(page.getByText('Registration complete', { exact: true })).toBeVisible();
  await expect(page.getByText('Registration failed', { exact: true })).toBeVisible();
  await expect(page.getByAltText('Masked browser screenshot of the verified failure')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Playwright reproduction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Replay steps' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'replay navigate' })).toBeVisible();
  await expect(page.getByText('synthetic-password')).toHaveCount(0);
});

test('healthy demo flow has no fabricated finding', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Local demo URL').fill('http://127.0.0.1:3001/health');
  await page.getByLabel('Goal (optional)').fill('');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete', { timeout: 60_000 });
  await expect(page.getByText('no-finding', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Playwright reproduction' })).toHaveCount(0);
});

test('external URL is rejected before a browser run', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Local demo URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Only the configured local demo URL is allowed');
  await expect(page.getByText('Actions will appear here as they run.')).toBeVisible();
});
