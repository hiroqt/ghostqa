import { expect, test } from 'vitest';
import { authorizeAction } from '../src/lib/executor';

const state = { allowedOrigins: ['http://127.0.0.1:3001'], actionCount: 0, startedAt: Date.now() };

test('permits only bounded typed actions on the demo origin', () => {
  expect(authorizeAction({ type: 'fill', target: 'Email', value: 'demo@example.test' }, state).type).toBe('fill');
  expect(() => authorizeAction({ type: 'delete', target: 'Account' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'click', target: 'Delete account' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'fill', target: 'Email', value: 'x'.repeat(501) }, state)).toThrow();
  expect(() => authorizeAction({ type: 'navigate', value: 'https://example.com' }, state)).toThrow();
  expect(() => authorizeAction({ type: 'navigate', value: 'http://127.0.0.1:3001/health' }, { ...state, actionCount: 10 })).toThrow();
  expect(() => authorizeAction({ type: 'wait', value: '200' }, { ...state, startedAt: Date.now() - 60_001 })).toThrow();
});
