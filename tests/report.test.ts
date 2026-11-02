import { expect, test } from 'vitest';
import { buildReport } from '../src/lib/report';

const secret = 'real-demo-password-123';
const verified = {
  status: 'verified' as const,
  url: 'http://127.0.0.1:3001/register?token=secret-token',
  expected: 'Registration succeeds',
  actual: 'Registration returned HTTP 500',
  observation: {
    screenshotPath: 'evidence/run-1/failure.png',
    dom: 'Registration failed',
    consoleErrors: ['Request failed for demo@example.test'],
    httpFailures: [{ url: 'http://127.0.0.1:3001/register?token=secret-token', status: 500 }],
  },
  trace: [
    { action: { type: 'navigate' as const, value: 'http://127.0.0.1:3001/register?token=secret-token' }, outcome: 'opened' },
    { action: { type: 'fill' as const, target: 'Password', value: secret }, outcome: 'filled' },
    { action: { type: 'click' as const, target: 'Create account' }, outcome: 'HTTP 500' },
  ],
  replaySteps: [
    { type: 'navigate' as const, value: 'http://127.0.0.1:3001/register' },
    { type: 'fill' as const, target: 'Email', value: 'demo@example.test' },
    { type: 'fill' as const, target: 'Password', value: secret },
    { type: 'click' as const, target: 'Create account' },
  ],
};

test('verified report carries evidence and a Playwright test without entered values', () => {
  const report = buildReport(verified);
  expect(report.status).toBe('verified');
  expect(report.finding).toMatchObject({
    expected: 'Registration succeeds',
    actual: 'Registration returned HTTP 500',
    screenshotPath: 'evidence/run-1/failure.png',
    httpFailures: [{ url: 'http://127.0.0.1:3001/register', status: 500 }],
  });
  expect(report.markdown).toContain('Registration returned HTTP 500');
  expect(report.markdown).toContain('evidence/run-1/failure.png');
  expect(report.finding?.reproductionTest).toContain("getByRole('button'");
  expect(report.finding?.reproductionTest).toContain('toEqual([])');
  expect(JSON.stringify(report)).not.toContain(secret);
  expect(JSON.stringify(report)).not.toContain('secret-token');
  expect(JSON.stringify(report)).not.toContain('demo@example.test');
});

test.each(['no-finding', 'inconclusive'] as const)('%s has no bug claim or reproduction', (status) => {
  const report = buildReport({ status, reason: 'No confirmed failure', trace: verified.trace });
  expect(report.finding).toBeUndefined();
  expect(report.markdown).not.toContain('Verified finding');
  expect(JSON.stringify(report)).not.toContain(secret);
});

test('a missing failure prevents a verified report', () => {
  expect(() => buildReport({ ...verified, observation: { ...verified.observation, httpFailures: [] } })).toThrow();
});

test('unsafe replay targets cannot become executable test code', () => {
  expect(() => buildReport({ ...verified, replaySteps: [{ type: 'click', target: "x'); process.exit(1); //" }] })).toThrow();
});
