import { expect, test } from 'vitest';
import type { BrowserContext, Page, Route } from 'playwright';
import { authorizeAction, executeAction, installNetworkGuard } from '../src/lib/executor';

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

test('fixture assets are readable but other paths and writes stay denied', async () => {
  expect(authorizeAction({ type: 'navigate', value: 'http://127.0.0.1:3001/slop' }, state).type).toBe('navigate');
  expect(() => authorizeAction({ type: 'navigate', value: 'http://127.0.0.1:3001/custom' }, state)).toThrow('Navigation path denied');
  let guard: ((route: Route) => Promise<void>) | undefined;
  const context = { route: async (_pattern: string, callback: (route: Route) => Promise<void>) => { guard = callback; } } as unknown as BrowserContext;
  await installNetworkGuard(context, state.allowedOrigins);
  if (!guard) throw new Error('Network guard was not installed');
  const outcomes: string[] = [];
  for (const [url, method] of [
    ['http://127.0.0.1:3001/slop.css', 'GET'],
    ['http://127.0.0.1:3001/slop.js', 'GET'],
    ['http://127.0.0.1:3001/custom', 'GET'],
    ['http://127.0.0.1:3001/slop.js', 'POST'],
    ['https://example.com/app.js', 'GET'],
  ]) await guard({
    request: () => ({ url: () => url, method: () => method }),
    continue: async () => { outcomes.push('continued'); },
    abort: async () => { outcomes.push('aborted'); },
  } as unknown as Route);
  expect(outcomes).toEqual(['continued', 'continued', 'aborted', 'aborted', 'aborted']);
});

test('live review allows same-origin reads and blocks writes and cross-origin requests', async () => {
  let guard: ((route: Route) => Promise<void>) | undefined;
  const context = { route: async (_pattern: string, callback: (route: Route) => Promise<void>) => { guard = callback; } } as unknown as BrowserContext;
  await installNetworkGuard(context, ['https://example.com'], true, true);
  if (!guard) throw new Error('Network guard was not installed');
  const outcomes: string[] = [];
  for (const [url, method] of [
    ['https://example.com/', 'GET'],
    ['https://example.com/app.css', 'HEAD'],
    ['https://example.com/api/submit', 'POST'],
    ['https://other.example/app.js', 'GET'],
  ]) await guard({
    request: () => ({ url: () => url, method: () => method }),
    continue: async () => { outcomes.push('continued'); },
    abort: async () => { outcomes.push('aborted'); },
  } as unknown as Route);
  expect(outcomes).toEqual(['continued', 'continued', 'aborted', 'aborted']);
});

test('executeAction falls back to substring-matched control or input placeholder when exact match is missing', async () => {
  const clicked: string[] = [];
  const filled: string[] = [];
  const makeLoc = (count: number, name: string) => ({
    first: () => ({
      count: async () => count,
      click: async () => { clicked.push(name); },
      fill: async (val: string) => { filled.push(`${name}:${val}`); },
      press: async (key: string) => { clicked.push(`${name}:${key}`); },
    }),
  });
  const page = {
    getByRole: (_role: string, opts?: { exact?: boolean }) => ({
      or: () => makeLoc(opts?.exact ? 0 : 1, opts?.exact ? 'exact-role' : 'fuzzy-role'),
    }),
    getByLabel: (_label: string, opts?: { exact?: boolean }) => makeLoc(opts?.exact ? 0 : 1, opts?.exact ? 'exact-label' : 'fuzzy-label'),
    getByPlaceholder: () => makeLoc(1, 'placeholder'),
  } as unknown as Page;

  await executeAction(page, { type: 'click', target: 'Learn more' });
  await executeAction(page, { type: 'fill', target: 'Email', value: 'qa@example.test' });
  expect(clicked).toEqual(['fuzzy-role']);
  expect(filled).toEqual(['fuzzy-label:qa@example.test']);
});
