import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { createObserver } from '../src/lib/browser';

function fakePage(pageUrl = 'http://127.0.0.1:3001/register', hiddenSuccess = false) {
  const listeners: Record<string, (value: unknown) => void> = {};
  const mask = { marker: 'masked controls' };
  const screenshot = vi.fn(async () => Buffer.from('synthetic screenshot'));
  const control = (attrs: Record<string, string>, text = '', visible = true) => ({
    getAttribute: vi.fn(async (name: string) => attrs[name] ?? null),
    textContent: vi.fn(async () => text),
    isVisible: vi.fn(async () => visible),
  });
  const page = {
    on: (event: string, callback: (value: unknown) => void) => { listeners[event] = callback; },
    url: () => pageUrl,
    locator: (selector: string) => selector === 'h1,h2,h3'
      ? { all: async () => hiddenSuccess ? [control({}, 'Registration complete', false), control({}, 'Registration failed')] : [control({}, 'Registration failed')] }
      : selector === 'a,button,label'
        ? { all: async () => [control({}, 'Create account')] }
        : selector === 'input,select,textarea'
          ? { all: async () => [control({ type: 'email', name: 'email', 'aria-label': 'Email', value: 'private@example.test' })] }
        : mask,
    screenshot,
  };
  return { page: page as unknown as Page, listeners, mask, screenshot };
}

describe('GQ-002 browser observer', () => {
  it('captures labeled headings and controls without private values', async () => {
    const { page } = fakePage();
    const observation = await createObserver(page, 'http://127.0.0.1:3001', '/tmp/ghostqa-start.png').observe();
    expect(observation.screenshotPath).toBe('/tmp/ghostqa-start.png');
    expect(observation.dom).toContain('Registration failed');
    expect(observation.dom).toContain('Create account');
    expect(observation.dom).toContain('Email');
    expect(observation.dom).not.toContain('private@example.test');
  });

  it('ignores a hidden success heading when observing failure', async () => {
    const { page } = fakePage('http://127.0.0.1:3001/register', true);
    const observation = await createObserver(page, 'http://127.0.0.1:3001', '/tmp/ghostqa-hidden.png').observe();
    expect(JSON.parse(observation.dom).headings).toEqual(['Registration failed']);
  });

  it('redacts console errors and records only same-origin HTTP failure paths', async () => {
    const { page, listeners } = fakePage();
    const observer = createObserver(page, 'http://127.0.0.1:3001', '/tmp/ghostqa-error.png');
    listeners.console({ type: () => 'error', text: () => 'Failed for private@example.test token=abc123' });
    listeners.response({ status: () => 500, url: () => 'http://127.0.0.1:3001/register?token=abc123' });
    listeners.response({ status: () => 500, url: () => 'https://other.test/register' });
    const observation = await observer.observe();
    expect(observation.consoleErrors).toEqual(['Failed for [redacted] token=[redacted]']);
    expect(observation.httpFailures).toEqual([{ url: 'http://127.0.0.1:3001/register', status: 500 }]);
    expect(JSON.stringify(observation)).not.toContain('abc123');
  });

  it('masks sensitive controls in the screenshot', async () => {
    const { page, mask, screenshot } = fakePage();
    await createObserver(page, 'http://127.0.0.1:3001', '/tmp/ghostqa-mask.png').observe();
    expect(screenshot).toHaveBeenCalledWith(expect.objectContaining({ path: '/tmp/ghostqa-mask.png', mask: [mask] }));
  });

  it('refuses to observe a page after cross-origin navigation', async () => {
    const { page, screenshot } = fakePage('https://other.test');
    await expect(createObserver(page, 'http://127.0.0.1:3001', '/tmp/ghostqa-denied.png').observe()).rejects.toThrow('ORIGIN_DENIED');
    expect(screenshot).not.toHaveBeenCalled();
  });
});
