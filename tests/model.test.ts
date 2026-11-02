import { describe, expect, it } from 'vitest';
import { MetaAdapter, MockAdapter, parseDecision, type ReasoningAdapter } from '../src/lib/model';

const context = {
  observation: { screenshotPath: 'evidence/start.png', dom: '<button>Register</button>', consoleErrors: [], httpFailures: [] },
  goal: 'Try registering',
  priorTrace: [],
};

describe('GQ-003 reasoning adapter', () => {
  it('accepts one complete action and STOP decision', () => {
    const click = { kind: 'action', action: { type: 'click', target: 'Register' }, expected: 'Confirmation appears', rationale: 'Submit registration' };
    expect(parseDecision(JSON.stringify(click))).toEqual(click);
    expect(parseDecision({ kind: 'stop', reason: 'Goal reached' })).toEqual({ kind: 'stop', reason: 'Goal reached' });
  });

  it.each([
    { kind: 'action', action: { type: 'delete', target: 'account' }, expected: 'Gone', rationale: 'Delete' },
    { kind: 'action', action: { type: 'click', target: 'Register' }, rationale: 'Missing expected' },
    { kind: 'action', action: { type: 'fill', target: 'Email', value: 'x'.repeat(501) }, expected: 'Filled', rationale: 'Enter email' },
    { kind: 'stop', reason: 'Done', extra: 'untrusted' },
    '{bad json',
  ])('rejects malformed or unsafe model output: %j', (raw) => {
    expect(() => parseDecision(raw)).toThrow();
  });

  it('returns mock decisions in order and stops after the sequence', async () => {
    const adapter: ReasoningAdapter = new MockAdapter([
      { kind: 'action', action: { type: 'click', target: 'Register' }, expected: 'Confirmation appears', rationale: 'Submit' },
      { kind: 'stop', reason: 'Done' },
    ]);
    expect((await adapter.decide(context)).kind).toBe('action');
    expect(await adapter.decide(context)).toEqual({ kind: 'stop', reason: 'Done' });
    expect(await adapter.decide(context)).toEqual({ kind: 'stop', reason: 'Mock decisions exhausted' });
  });

  it('blocks live Meta requests until their contract is verified', async () => {
    const adapter: ReasoningAdapter = new MetaAdapter();
    await expect(adapter.decide(context)).rejects.toThrow(/BLOCKED/);
  });
});
