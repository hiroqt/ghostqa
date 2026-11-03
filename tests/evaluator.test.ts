import { describe, expect, it } from 'vitest';
import type { Observation } from '../src/lib/contracts';
import { evaluateOutcome } from '../src/lib/evaluator';

function observed(headings: string[], httpFailures: Observation['httpFailures'] = []): Observation {
  return { screenshotPath: 'evidence/page.png', dom: JSON.stringify({ headings, controls: [] }), consoleErrors: [], httpFailures };
}

const registrationFailure = { url: 'http://127.0.0.1:3001/register', status: 500 };
const expectedText = 'Registration confirmed';

describe('GQ-005 outcome evaluation', () => {
  it('reports no finding when the exact expected heading appears', () => {
    const before = observed([], [registrationFailure]);
    const after = observed(['Registration confirmed'], [registrationFailure]);
    expect(evaluateOutcome({ expectedText, before, after }).status).toBe('no-finding');
  });

  it('does not mistake a preexisting failure for action evidence', () => {
    const before = observed(['Register'], [registrationFailure]);
    const after = observed(['Registration failed'], [registrationFailure]);
    expect(evaluateOutcome({ expectedText, before, after }).status).toBe('inconclusive');
  });

  it('marks a missing expected heading with a new HTTP failure as suspected', () => {
    const before = observed(['Register']);
    const after = observed(['Registration failed'], [registrationFailure]);
    expect(evaluateOutcome({ expectedText, before, after })).toMatchObject({
      status: 'suspected',
      expected: expectedText,
      actual: 'Registration failed',
      httpFailure: registrationFailure,
    });
  });

  it('verifies only the same newly observed failure in a fresh replay', () => {
    const before = observed(['Register']);
    const after = observed(['Registration failed'], [registrationFailure]);
    const replay = { before: observed(['Register']), after: observed(['Registration failed'], [registrationFailure]) };
    expect(evaluateOutcome({ expectedText, before, after, replay }).status).toBe('verified');
  });

  it('keeps inconsistent replay inconclusive', () => {
    const before = observed(['Register']);
    const after = observed(['Registration failed'], [registrationFailure]);
    const replay = { before: observed(['Register']), after: observed(['Registration confirmed']) };
    expect(evaluateOutcome({ expectedText, before, after, replay }).status).toBe('inconclusive');
  });

  it('keeps malformed DOM evidence inconclusive', () => {
    const before = observed(['Register']);
    const after = { ...observed([], [registrationFailure]), dom: '{not json' };
    expect(evaluateOutcome({ expectedText, before, after }).status).toBe('inconclusive');
  });
});

describe('GQ-005/006 evidence hardening', () => {
  it('ignores favicon failures as functional evidence', () => {
    const favicon = { url: 'http://127.0.0.1:3001/favicon.ico', status: 404 };
    const before = observed(['Register']);
    const after = observed(['Registration failed'], [favicon]);
    expect(evaluateOutcome({ expectedText, before, after }).status).toBe('inconclusive');
  });

  it('requires the replay to show the same actual heading', () => {
    const before = observed(['Register']);
    const after = observed(['Registration failed'], [registrationFailure]);
    const replay = { before: observed(['Register']), after: observed(['Something else'], [registrationFailure]) };
    expect(evaluateOutcome({ expectedText, before, after, replay }).status).toBe('inconclusive');
  });
});
