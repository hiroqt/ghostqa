import { expect, test } from 'vitest';
import type { Browser, Page } from 'playwright';
import { replayOnce } from '../src/lib/replay';

function fakeBrowser(failClick = false) {
  let currentUrl = 'about:blank';
  let heading = 'Register';
  let closed = false;
  let created = 0;
  const responseListeners: ((response: unknown) => void)[] = [];
  const inputs: string[] = [];
  const page = {
    url: () => currentUrl,
    on: (event: string, listener: (response: unknown) => void) => {
      if (event === 'response') responseListeners.push(listener);
    },
    goto: async (url: string) => { currentUrl = url; },
    locator: (selector: string) => ({
      all: async () => selector === 'h1,h2,h3' ? [{ textContent: async () => heading, isVisible: async () => true }] : [],
    }),
    screenshot: async () => {},
    getByLabel: (label: string) => ({ fill: async (value: string) => { inputs.push(`${label}:${value}`); } }),
    getByRole: () => ({
      or: () => ({
        click: async () => {
          if (failClick) throw new Error('click failed');
          heading = 'Registration failed';
          responseListeners.forEach((listener) => listener({
            status: () => 500,
            url: () => 'http://127.0.0.1:3001/register',
          }));
        },
      }),
    }),
  } as unknown as Page;
  const browser = {
    newContext: async () => {
      created++;
      return {
      route: async () => {},
      newPage: async () => page,
      close: async () => { closed = true; },
      };
    },
  } as unknown as Browser;
  return { browser, inputs, isClosed: () => closed, contextsCreated: () => created };
}

test('replays exact steps in a fresh context and captures the repeated failure', async () => {
  const fake = fakeBrowser();
  const gate = { allowedOrigins: ['http://127.0.0.1:3001'], actionCount: 4, startedAt: Date.now() };
  const actions = [
    { type: 'fill', target: 'Email', value: 'demo@example.test' },
    { type: 'fill', target: 'Password', value: 'synthetic-password' },
    { type: 'click', target: 'Create account' },
  ] as const;
  const replay = await replayOnce(fake.browser, 'http://127.0.0.1:3001/register', actions, gate, '/tmp/ghostqa-replay-unit');

  expect(fake.inputs).toEqual(['Email:demo@example.test', 'Password:synthetic-password']);
  expect(JSON.parse(replay.before.dom).headings).toEqual(['Register']);
  expect(replay.after.httpFailures).toEqual([{ url: 'http://127.0.0.1:3001/register', status: 500 }]);
  expect(replay.replaySteps.map((action) => action.type)).toEqual(['navigate', 'fill', 'fill', 'click']);
  expect(gate.actionCount).toBe(8);
  expect(fake.isClosed()).toBe(true);
});

test('closes a failed replay and rejects an over-budget replay before context creation', async () => {
  const failed = fakeBrowser(true);
  const gate = { allowedOrigins: ['http://127.0.0.1:3001'], actionCount: 1, startedAt: Date.now() };
  await expect(replayOnce(failed.browser, 'http://127.0.0.1:3001/register',
    [{ type: 'click', target: 'Create account' }], gate, '/tmp/ghostqa-replay-failure')).rejects.toThrow('click failed');
  expect(failed.isClosed()).toBe(true);

  const overBudget = fakeBrowser();
  await expect(replayOnce(overBudget.browser, 'http://127.0.0.1:3001/register',
    [{ type: 'click', target: 'Create account' }], { ...gate, actionCount: 9 }, '/tmp/ghostqa-replay-budget')).rejects.toThrow('Replay exceeds action limit');
  expect(overBudget.contextsCreated()).toBe(0);
});
