import { describe, expect, it } from 'vitest';
import { assertAllowedUrl, UrlPolicyError } from '../src/lib/policy';

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
});
