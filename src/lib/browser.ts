import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, Page } from 'playwright';
import type { Observation } from './contracts';
import { assertAllowedUrl } from './policy';

function clean(value: string, limit = 120): string {
  return value.slice(0, 500)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(token|password|secret|api[_-]?key|cookie|session|authorization)\s*[:=]\s*[^&\s]+/gi, '$1=[redacted]')
    .slice(0, limit);
}

async function attribute(locator: Locator, name: string): Promise<string | undefined> {
  const value = await locator.getAttribute(name, { timeout: 500 });
  return value ? clean(value) : undefined;
}

export function createObserver(page: Page, allowedOrigin: string, screenshotPath: string, liveMode = false) {
  const consoleErrors: string[] = [];
  const httpFailures: Observation['httpFailures'] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && consoleErrors.length < 10) consoleErrors.push(clean(message.text(), 200));
  });
  page.on('pageerror', (error) => {
    if (consoleErrors.length < 10) consoleErrors.push(clean(error.message, 200));
  });
  page.on('response', (response) => {
    if (response.status() < 400 || httpFailures.length >= 10) return;
    try {
      const url = new URL(response.url());
      if (url.origin === allowedOrigin) httpFailures.push({ url: clean(url.origin + url.pathname, 200), status: response.status() });
    } catch { /* Ignore malformed URLs from untrusted page events. */ }
  });

  return {
    async observe(): Promise<Observation> {
      assertAllowedUrl(page.url(), [allowedOrigin], { liveMode });
      const headings = await page.locator('h1,h2,h3').all();
      const textControls = await page.locator('a,button,label').all();
      const fields = await page.locator('input,select,textarea').all();
      const controls = [];
      for (const locator of textControls.slice(0, 5)) {
        try {
          const text = clean((await locator.textContent({ timeout: 500 })) ?? '');
          controls.push({ text, for: await attribute(locator, 'for') });
        } catch { /* A detached control is absent from this observation. */ }
      }
      for (const locator of fields.slice(0, 5)) {
        try {
          controls.push({
            label: await attribute(locator, 'aria-label'),
            id: await attribute(locator, 'id'),
            name: await attribute(locator, 'name'),
            type: await attribute(locator, 'type'),
            placeholder: await attribute(locator, 'placeholder'),
          });
        } catch { /* A detached field is absent from this observation. */ }
      }
      const visibleHeadings: string[] = [];
      for (const locator of headings.slice(0, 5)) {
        try {
          if (await locator.isVisible()) visibleHeadings.push(clean((await locator.textContent({ timeout: 500 })) ?? ''));
        }
        catch { /* A detached heading is absent from this observation. */ }
      }
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, mask: [page.locator('input,textarea,select,[data-private]')], animations: 'disabled' });
      return { screenshotPath, dom: JSON.stringify({ headings: visibleHeadings, controls }), consoleErrors: [...consoleErrors], httpFailures: [...httpFailures] };
    },
  };
}
