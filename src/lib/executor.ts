import type { BrowserContext, Page } from 'playwright';
import { proposedActionSchema, type ProposedAction } from './contracts';
import { assertAllowedUrl } from './policy';

type RunGate = { allowedOrigins: readonly string[]; actionCount: number; startedAt: number };

export function authorizeAction(raw: unknown, gate: RunGate): ProposedAction {
  if (gate.actionCount >= 10) throw new Error('Action limit reached');
  if (Date.now() - gate.startedAt >= 60_000) throw new Error('Run timed out');
  const action = proposedActionSchema.parse(raw);

  switch (action.type) {
    case 'navigate':
      if (!action.value) throw new Error('Navigation URL required');
      action.value = assertAllowedUrl(action.value, gate.allowedOrigins);
      if (!['/', '/register', '/health'].includes(new URL(action.value).pathname) || new URL(action.value).search) {
        throw new Error('Navigation path denied');
      }
      return action;
    case 'click':
      // shortcut: fixture-only controls, expand only when another demo flow is approved.
      if (!action.target || !['Create account', 'Register', 'Health'].includes(action.target)) {
        throw new Error('Unsafe click target');
      }
      break;
    case 'fill':
      if (!action.target || !['Email', 'Password'].includes(action.target) || action.value === undefined) {
        throw new Error('Unsafe fill target');
      }
      break;
    case 'press':
      if (!action.target || !['Email', 'Password'].includes(action.target) ||
          !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(action.value ?? '')) {
        throw new Error('Unsafe key');
      }
      break;
    case 'scroll':
      if (!action.value || !Number.isInteger(Number(action.value)) || Math.abs(Number(action.value)) > 1000) {
        throw new Error('Invalid scroll amount');
      }
      break;
    case 'wait':
      if (!action.value || !Number.isInteger(Number(action.value)) || Number(action.value) < 0 || Number(action.value) > 2000) {
        throw new Error('Invalid wait duration');
      }
  }
  return action;
}

export async function installNetworkGuard(context: BrowserContext, allowedOrigins: readonly string[]): Promise<void> {
  await context.route('**/*', async (route) => {
    try {
      const url = assertAllowedUrl(route.request().url(), allowedOrigins);
      const method = route.request().method();
      const parsed = new URL(url);
      if (!['/', '/register', '/health'].includes(parsed.pathname) || parsed.search ||
          (!['GET', 'HEAD'].includes(method) && !(method === 'POST' && parsed.pathname === '/register'))) {
        throw new Error('Request method denied');
      }
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
}

export async function executeAction(page: Page, action: ProposedAction): Promise<void> {
  switch (action.type) {
    case 'navigate':
      await page.goto(action.value!, { waitUntil: 'domcontentloaded' });
      break;
    case 'click':
      await page.getByRole('button', { name: action.target!, exact: true })
        .or(page.getByRole('link', { name: action.target!, exact: true })).click();
      break;
    case 'fill':
      await page.getByLabel(action.target!, { exact: true }).fill(action.value!);
      break;
    case 'press':
      await page.getByLabel(action.target!, { exact: true }).press(action.value!);
      break;
    case 'scroll':
      await page.mouse.wheel(0, Number(action.value));
      break;
    case 'wait':
      await page.waitForTimeout(Number(action.value));
  }
}
