import { expect, test } from 'vitest';
import type { BrowserContext, Route } from 'playwright';
import { authorizeAction, installNetworkGuard } from '../src/lib/executor';

const state = { allowedOrigins: ['http://127.0.0.1:3001'], actionCount: 0, startedAt: Date.now() };

test('permits only bounded typed actions on the demo origin', () => {
  expect(authorizeAction({ type: 'fill', target: 'Email', value: 'demo@example.test' }, state).type).toBe('fill');
  expect(() => authorizeAction({ type: 'delete', target: 'Account' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'click', target: 'Delete account' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'click', target: 'Erase records' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'fill', target: 'Payment card', value: '123' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'navigate', value: 'http://127.0.0.1:3001/delete' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'fill', target: 'Email', value: 'x'.repeat(501) }, state)).toThrow();
  expect(() => authorizeAction({ type: 'navigate', value: 'https://example.com' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'navigate', value: 'http://127.0.0.1:3001/health' }, { ...state, actionCount: 10 })).toThrow();
  expect(() => authorizeAction({ type: 'wait', value: '200' }, { ...state, startedAt: Date.now() - 60_001 })).toThrow();
});

test('aborts cross-origin redirects and unapproved local requests', async () => {
  let guard: ((route: Route) => Promise<void>) | undefined;
  const context = { route: async (_pattern: string, callback: (route: Route) => Promise<void>) => { guard = callback; } } as unknown as BrowserContext;
  await installNetworkGuard(context, state.allowedOrigins);
  if (!guard) throw new Error('Network guard was not installed');
  const outcomes: string[] = [];
  for (const url of ['https://example.com/', 'http://127.0.0.1:3001/delete']) {
    await guard({
      request: () => ({ url: () => url, method: () => 'GET' }),
      continue: async () => { outcomes.push('continued'); },
      abort: async () => { outcomes.push('aborted'); },
    } as unknown as Route);
  }
  expect(outcomes).toEqual(['aborted', 'aborted']);
});
