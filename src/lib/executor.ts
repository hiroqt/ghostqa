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
      return { ...action, value: assertAllowedUrl(action.value, gate.allowedOrigins) };
    case 'click':
      if (!action.target || /\b(delete|remove|pay|purchase|send|upload|download)\b/i.test(action.target)) {
        throw new Error('Unsafe click target');
      }
      break;
    case 'fill':
      if (!action.target || action.value === undefined) throw new Error('Fill target and value required');
      break;
    case 'press':
      if (!action.target || !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(action.value ?? '')) {
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
      if (!['GET', 'HEAD'].includes(method) && !(method === 'POST' && new URL(url).pathname === '/register')) {
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
