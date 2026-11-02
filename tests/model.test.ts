import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { COMMON_TEST_GOALS, fallbackSuggestions, MetaAdapter, MockAdapter, parseDecision, type ReasoningAdapter } from '../src/lib/model';

const context = {
  observation: { screenshotPath: 'evidence/start.png', dom: '<button>Register</button>', consoleErrors: [], httpFailures: [] },
  goal: 'Try registering',
  priorTrace: [],
};

function mockClient(content: string) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] });
  return { client: { chat: { completions: { create } } }, create };
}

function userContent(create: ReturnType<typeof vi.fn>): Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const messages = create.mock.calls[0][0].messages as Array<{ role: string; content: unknown }>;
  const user = messages.find((message) => message.role === 'user');
  return user!.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

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

  it('parses a strict JSON decision from the mocked Meta client', async () => {
    const decision = { kind: 'action', action: { type: 'click', target: 'Register' }, expected: 'Confirmation appears', rationale: 'Submit' };
    const { client, create } = mockClient(JSON.stringify(decision));
    const adapter: ReasoningAdapter = new MetaAdapter({ apiKey: 'test-key', client });
    expect(await adapter.decide(context)).toEqual(decision);
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('muse-spark-1.3');
  });

  it('attaches a screenshot as an image_url item when the file exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghostqa-model-'));
    const shot = join(dir, 'latest.png');
    writeFileSync(shot, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const { client, create } = mockClient(JSON.stringify({ kind: 'stop', reason: 'Done' }));
    const adapter = new MetaAdapter({ apiKey: 'test-key', client });
    await adapter.decide({ ...context, observation: { ...context.observation, screenshotPath: shot } });
    const parts = userContent(create);
    expect(parts.some((part) => part.type === 'text' && part.text?.includes('<button>Register</button>'))).toBe(true);
    const image = parts.find((part) => part.type === 'image_url');
    expect(image?.image_url?.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('falls back to text-only when the screenshot file is missing', async () => {
    const { client, create } = mockClient(JSON.stringify({ kind: 'stop', reason: 'Done' }));
    const adapter = new MetaAdapter({ apiKey: 'test-key', client });
    await adapter.decide({ ...context, observation: { ...context.observation, screenshotPath: '/nonexistent/missing.png' } });
    const parts = userContent(create);
    expect(parts.some((part) => part.type === 'text' && part.text?.includes('<button>Register</button>'))).toBe(true);
    expect(parts.some((part) => part.type === 'image_url')).toBe(false);
  });

  it('rejects malformed or oversized model output before any action', async () => {
    const bad = mockClient('{not json');
    await expect(new MetaAdapter({ apiKey: 'k', client: bad.client }).decide(context)).rejects.toThrow();
    const oversized = mockClient('x'.repeat(8193));
    await expect(new MetaAdapter({ apiKey: 'k', client: oversized.client }).decide(context)).rejects.toThrow(/too large/);
    const unsafe = mockClient(JSON.stringify({ kind: 'action', action: { type: 'delete', target: 'account' }, expected: 'Gone', rationale: 'Delete' }));
    await expect(new MetaAdapter({ apiKey: 'k', client: unsafe.client }).decide(context)).rejects.toThrow();
  });

  it('extracts JSON decisions and suggestions even when wrapped in markdown code fences', async () => {
    const decision = { kind: 'stop', reason: 'Page verified healthy' };
    expect(parseDecision(`\`\`\`json\n${JSON.stringify(decision)}\n\`\`\``)).toEqual(decision);
    const suggestions = [{ text: 'Add alt text', reason: 'Screen readers', selector: 'img', location: '<img>', codeSnippet: '<img alt="Hero">' }];
    const { client } = mockClient(`Here are improvements:\n\`\`\`json\n${JSON.stringify(suggestions)}\n\`\`\``);
    const adapter = new MetaAdapter({ apiKey: 'test-key', client });
    expect(await adapter.suggestImprovements('{"headings":["Home"],"controls":[]}', '/nonexistent.png')).toEqual(suggestions);
  });

  it('provides common functional test goals and deterministic fallback suggestions when model returns none', () => {
    expect(COMMON_TEST_GOALS.length).toBeGreaterThanOrEqual(4);
    const fallback = fallbackSuggestions(JSON.stringify({ headings: ['Welcome'], controls: [{ text: 'Get started' }] }));
    expect(fallback.length).toBeGreaterThanOrEqual(3);
    expect(fallback.every((item) => item.text && item.reason && item.selector && item.location)).toBe(true);
  });
});
