import { expect, test } from '@playwright/test';

test('workspace layout keeps progress and content readable on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Test workspace' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Run progress' })).toBeVisible();
  const shellWidth = await page.locator('.shell').evaluate((node) => node.getBoundingClientRect().width);
  expect(shellWidth).toBeGreaterThan(900);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('status', { name: 'Run progress' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('seeded registration failure is replayed and reported with evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete', { timeout: 60_000 });
  await expect(page.getByText('verified', { exact: true })).toBeVisible();
  await expect(page.getByText('Registration complete', { exact: true })).toBeVisible();
  await expect(page.getByText('Registration failed', { exact: true })).toBeVisible();
  await expect(page.getByAltText('Masked browser screenshot of the verified failure')).toBeVisible();
  await expect(page.getByAltText('Latest masked browser observation')).toBeVisible();
  await expect(page.getByText('Observed outcome', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enlarge evidence image' }).click();
  await expect(page.getByAltText('Masked browser screenshot of the verified failure')).toHaveClass(/expanded/);
  await expect(page.getByRole('heading', { name: 'Playwright reproduction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Replay steps' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'replay navigate' })).toBeVisible();
  await expect(page.getByText('synthetic-password')).toHaveCount(0);
});

test('masked page observation streams before the final result', async ({ request }) => {
  const response = await request.post('/api/runs', {
    data: { url: 'http://127.0.0.1:3201/health', goal: '' },
  });
  expect(response.ok()).toBe(true);
  const events = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
  const observed = events.findIndex((event) => event.type === 'observation');
  const done = events.findIndex((event) => event.type === 'done');
  expect(observed).toBeGreaterThan(-1);
  expect(observed).toBeLessThan(done);
  expect(events[observed].screenshot).toMatch(/^data:image\/png;base64,/);
});

test('healthy demo flow has no fabricated finding', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Local demo URL').fill('http://127.0.0.1:3201/health');
  await page.getByLabel('Goal (optional)').fill('');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete', { timeout: 60_000 });
  await expect(page.getByText('no-finding', { exact: true })).toBeVisible();
  await expect(page.getByText('Validation complete')).toBeVisible();
  await expect(page.getByText('Landmarks help screen reader users move between major page regions.')).toBeVisible();
  await expect(page.getByText('After · suggested code').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Playwright reproduction' })).toHaveCount(0);
});

test('AI slop review stamps only a six-observation story', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Review type').selectOption('slop');
  await expect(page.getByLabel('Local demo URL')).toHaveValue('http://127.0.0.1:3201/slop');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByText('Analyzing page design')).toBeVisible();
  await expect(page.getByLabel('Live page observation')).toHaveCount(0);
  await expect(page.locator('.slop-showcase')).toBeVisible({ timeout: 60_000 });
  expect(await page.locator('.slop-showcase .slop-stamp').evaluate((node) => getComputedStyle(node).animationName)).toBe('slop-stamp-in');
  await expect(page.locator('.slop-showcase .slop-stamp')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Findings story' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.slop-showcase')).toHaveCount(0);
  await expect(page.locator('.slop-observation .slop-stamp')).toBeVisible();
  await expect(page.getByLabel('Live page observation')).toBeFocused();
  await expect(page.getByText('23% of detectable patterns matched', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Impeccable/i })).toHaveCount(0);
  const stamp = page.locator('.slop-observation .slop-stamp');
  expect(await stamp.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await stamp.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await expect(page.getByRole('list', { name: 'AI slop observations' }).getByRole('listitem')).toHaveCount(8);
  await expect(page.getByText('Patterns do not prove AI authorship.')).toBeVisible();
  await page.getByText('Preview Markdown guide').click();
  await expect(page.locator('.slop-guide-preview pre')).toContainText('# GhostQA design review handoff');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy agent guide (Markdown)' }).click();
  await expect(page.getByText('Markdown guide copied')).toBeVisible();
  const guide = await page.evaluate(() => navigator.clipboard.readText());
  expect(guide).toContain('# GhostQA design review handoff');
  expect(guide).toContain('**Why review it:**');
  expect(guide).not.toContain('sensitive-debug-value');

  await page.getByLabel('Local demo URL').fill('http://127.0.0.1:3201/health');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByText('Insufficient evidence for a findings story')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('0% of detectable patterns matched', { exact: false })).toBeVisible();
  await expect(page.getByText('AI SLOP', { exact: true })).toHaveCount(0);
});

test('external URL is rejected before a browser run', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Local demo URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('status')).toHaveText('Only the configured local demo URL is allowed');
  await expect(page.getByText('Actions will appear here as they run.')).toBeVisible();
});
