import { expect, test } from 'vitest';
import { reviewTechnical } from '../src/lib/technical-review';

test('reports bounded technical signals without exposing a credential', () => {
  const report = reviewTechnical([
    { kind: 'html', text: '<form><input type="password"></form><a href="/admin?debug=true">Admin</a><script>const API_KEY="sk_live_abcdefghijklmnop123456"; // TODO test</script>' },
    { kind: 'js', text: 'console.log("debug");' },
  ], { resources: 3, bytes: 1_500_000, largestBytes: 1_100_000, loadMs: 4200, headers: {} });
  expect(report.findings.map((item) => item.id)).toEqual(expect.arrayContaining(['credential-exposure', 'debug-code', 'heavy-transfer', 'slow-load', 'suspicious-link', 'missing-policy-links']));
  expect(JSON.stringify(report)).not.toContain('sk_live_abcdefghijklmnop123456');
  expect(report.findings.find((item) => item.id === 'suspicious-link')?.detail).not.toContain('/admin?debug=true');
});

test('keeps missing consent and policy checks contextual and bypass claims unverified', () => {
  const report = reviewTechnical([{ kind: 'html', text: '<main><h1>About</h1><a href="/terms">Terms</a><a href="/privacy">Privacy</a></main>' }], { resources: 1, bytes: 1000, largestBytes: 1000, loadMs: 100, headers: {} });
  expect(report.findings.some((item) => ['missing-policy-links', 'missing-consent', 'suspicious-link'].includes(item.id))).toBe(false);
  expect(report.findings.some((item) => item.id === 'missing-csp')).toBe(false);
});
