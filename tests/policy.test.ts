import { describe, expect, it } from 'vitest';
import { assertAllowedUrl, assertLiveUrl, UrlPolicyError } from '../src/lib/policy';

const allowed = ['http://127.0.0.1:3001'];

describe('GQ-001 URL policy', () => {
  it('accepts only the configured loopback origin', () => {
    expect(assertAllowedUrl('http://127.0.0.1:3001/register', allowed)).toBe('http://127.0.0.1:3001/register');
    expect(assertAllowedUrl('http://127.0.0.1:3001', allowed)).toBe('http://127.0.0.1:3001/');
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://127.0.0.1:3001.evil.test/register',
    'http://127.0.0.1:3002/register',
    'http://user:pass@127.0.0.1:3001/register',
    '/register',
  ])('rejects unsupported or disguised origin %s', (url) => {
    expect(() => assertAllowedUrl(url, allowed)).toThrow(UrlPolicyError);
  });

  it.each([
    { origins: [] },
    { origins: ['https://example.com'] },
    { origins: ['http://127.0.0.1:3001/register'] },
    { origins: ['http://127.0.0.1:3001?token=x'] },
    { origins: ['javascript:alert(1)'] },
  ])('rejects unsafe allowlist configuration $origins', ({ origins }) => {
    expect(() => assertAllowedUrl('http://127.0.0.1:3001/register', origins)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ALLOWLIST' }),
    );
  });

  it('applies the same check to a redirect URL', () => {
    expect(() => assertAllowedUrl('http://localhost:3001/done', allowed)).toThrowError(
      expect.objectContaining({ code: 'ORIGIN_DENIED' }),
    );
  });

  it('accepts a public origin only in live mode', () => {
    const live = ['https://example.com'];
    // Live mode off (default): a public origin is rejected as an unsafe allowlist entry.
    expect(() => assertAllowedUrl('https://example.com/pricing', live)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ALLOWLIST' }),
    );
    // Live mode on: the exact public origin is accepted and normalized.
    expect(assertAllowedUrl('https://example.com/pricing', live, { liveMode: true })).toBe('https://example.com/pricing');
    // A non-matching public origin is still denied in live mode.
    expect(() => assertAllowedUrl('https://evil.test/pricing', live, { liveMode: true })).toThrowError(
      expect.objectContaining({ code: 'ORIGIN_DENIED' }),
    );
  });

  it('rejects unsafe schemes and credentials in live mode', () => {
    const live = ['https://example.com'];
    for (const url of ['file:///etc/passwd', 'data:text/html,x', 'javascript:alert(1)', 'https://user:pass@example.com/x']) {
      expect(() => assertAllowedUrl(url, live, { liveMode: true })).toThrow(UrlPolicyError);
    }
    // Allowlist entries with a path/query or credentials remain invalid in live mode.
    for (const origins of [['https://example.com/path'], ['https://example.com?x=1'], ['https://user:pass@example.com']]) {
      expect(() => assertAllowedUrl('https://example.com/x', origins, { liveMode: true })).toThrowError(
        expect.objectContaining({ code: 'INVALID_ALLOWLIST' }),
      );
    }
  });

  it('derives the allowlist from the submitted URL in live mode', () => {
    expect(assertLiveUrl('https://example.com/pricing')).toEqual({
      url: 'https://example.com/pricing',
      origin: 'https://example.com',
    });
    expect(assertLiveUrl('https://docs.example.org:8443/a/b?q=1#frag')).toEqual({
      url: 'https://docs.example.org:8443/a/b?q=1#frag',
      origin: 'https://docs.example.org:8443',
    });
    expect(assertLiveUrl('http://public-demo.test/')).toEqual({
      url: 'http://public-demo.test/',
      origin: 'http://public-demo.test',
    });
  });

  it.each([
    'http://localhost/',
    'http://localhost:8080/admin',
    'https://app.localhost/',
    'http://127.0.0.1/',
    'http://127.0.0.1:3001/register',
    'http://127.1.2.3/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://10.0.0.5/',
    'http://10.255.255.255/',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.168.1.1/',
    'http://169.254.0.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://[fc00::1]/',
    'http://[fd12:3456::1]/',
    'http://[fe80::1]/',
  ])('rejects private and internal host %s in live mode', (url) => {
    expect(() => assertLiveUrl(url)).toThrowError(expect.objectContaining({ code: 'PRIVATE_HOST_DENIED' }));
  });

  it('accepts a public target adjacent to a private range in live mode', () => {
    // Guard against over-broad substring matching: 172.15.x and 172.32.x are public.
    expect(assertLiveUrl('http://172.15.0.1/').origin).toBe('http://172.15.0.1');
    expect(assertLiveUrl('http://172.32.0.1/').origin).toBe('http://172.32.0.1');
    expect(assertLiveUrl('http://8.8.8.8/').origin).toBe('http://8.8.8.8');
  });

  it('rejects unsafe schemes and credentials in assertLiveUrl', () => {
    for (const url of ['file:///etc/passwd', 'data:text/html,x', 'javascript:alert(1)', 'ftp://example.com/x', 'https://user:pass@example.com/x', '/relative']) {
      expect(() => assertLiveUrl(url)).toThrowError(
        expect.objectContaining({ code: 'INVALID_URL' }),
      );
    }
  });

  it('does not reject loopback when live mode is off', () => {
    // The loopback-only default path must keep accepting the local fixture origin.
    expect(assertAllowedUrl('http://127.0.0.1:3001/register', allowed)).toBe('http://127.0.0.1:3001/register');
  });
});
