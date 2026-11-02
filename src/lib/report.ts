import type { ActionTrace, Observation, ProposedAction, Suggestion } from './contracts';
import type { DesignReview } from './design-audit';

type PlainOutcome = { status: 'no-finding' | 'inconclusive'; reason: string; trace: ActionTrace[] };
type VerifiedOutcome = {
  status: 'verified';
  url: string;
  expected: string;
  actual: string;
  observation: Observation;
  trace: ActionTrace[];
  replaySteps: ProposedAction[];
};

type SafeTrace = { action: ProposedAction; outcome: string };
type Finding = {
  expected: string;
  actual: string;
  screenshotPath: string;
  consoleErrors: string[];
  httpFailures: Observation['httpFailures'];
  trace: SafeTrace[];
  replaySteps: ProposedAction[];
  reproductionTest: string;
};
export type RunReport = { status: PlainOutcome['status'] | 'verified' | 'review' | 'insufficient-evidence'; markdown: string; trace: SafeTrace[]; finding?: Finding; suggestions?: Suggestion[]; designReview?: DesignReview };

function cleanUrl(input: string): string {
  const url = new URL(input);
  return `${url.origin}${url.pathname}`;
}

function scrub(text: string, enteredValues: string[]): string {
  let safe = text;
  for (const value of enteredValues) if (value) safe = safe.replaceAll(value, '[REDACTED]');
  return safe
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
    .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/\b(password|token|cookie)=([^\s&]+)/gi, '$1=[REDACTED]');
}

function safeAction(action: ProposedAction, enteredValues: string[]): ProposedAction {
  return {
    ...action,
    target: action.target ? scrub(action.target, enteredValues) : undefined,
    value: action.type === 'fill' ? '[REDACTED]' : action.type === 'navigate' && action.value ? cleanUrl(action.value) : action.value ? scrub(action.value, enteredValues) : undefined,
  };
}

function replayLine(action: ProposedAction, origin: string): string {
  const target = action.target;
  switch (action.type) {
    case 'navigate': {
      if (!action.value || new URL(action.value).origin !== origin) throw new Error('Unsafe replay navigation');
      return `  await page.goto(${JSON.stringify(cleanUrl(action.value))});`;
    }
    case 'click':
      if (!target || !/^[\p{L}\p{N} _.-]{1,100}$/u.test(target)) throw new Error('Unsafe replay target');
      return `  await page.getByRole('button', { name: ${JSON.stringify(target)} }).click();`;
    case 'fill':
      if (!target || !/^[\p{L}\p{N} _.-]{1,100}$/u.test(target)) throw new Error('Unsafe replay target');
      return `  await page.getByLabel(${JSON.stringify(target)}).fill(${JSON.stringify(target.toLowerCase().includes('email') ? 'qa@example.test' : 'synthetic')});`;
    case 'press':
      if (!action.value || !/^(Enter|Tab|Escape|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(action.value)) throw new Error('Unsafe replay key');
      return `  await page.keyboard.press(${JSON.stringify(action.value)});`;
    case 'scroll':
    case 'wait': {
      const amount = Number(action.value);
      if (!Number.isInteger(amount) || amount < 0 || amount > 5000) throw new Error('Unsafe replay amount');
      return action.type === 'scroll' ? `  await page.mouse.wheel(0, ${amount});` : `  await page.waitForTimeout(${amount});`;
    }
  }
}

function reproductionTest(url: string, failureUrl: string, steps: ProposedAction[]): string {
  const origin = new URL(url).origin;
  if (new URL(failureUrl).origin !== origin) throw new Error('Failure outside demo origin');
  const failurePath = new URL(failureUrl).pathname;
  return [
    "import { test, expect } from '@playwright/test';",
    '',
    "test('registration should not return a server error', async ({ page }) => {",
    '  const failures: number[] = [];',
    `  page.on('response', response => { if (new URL(response.url()).origin === ${JSON.stringify(origin)} && new URL(response.url()).pathname === ${JSON.stringify(failurePath)} && response.status() >= 500) failures.push(response.status()); });`,
    ...steps.map((step) => replayLine(step, origin)),
    '  expect(failures).toEqual([]);',
    '});',
  ].join('\n');
}

export function buildReport(input: PlainOutcome | VerifiedOutcome): RunReport {
  const enteredValues = [...input.trace.map(({ action }) => action.type === 'fill' ? action.value ?? '' : '')];
  if (input.status !== 'verified') {
    return {
      status: input.status,
      markdown: `${input.status}: ${scrub(input.reason, enteredValues)}`,
      trace: input.trace.map(({ action, outcome }) => ({ action: safeAction(action, enteredValues), outcome: scrub(outcome, enteredValues) })),
    };
  }
  enteredValues.push(...input.replaySteps.map((action) => action.type === 'fill' ? action.value ?? '' : ''));
  const failure = input.observation.httpFailures.find(({ status }) => status >= 500);
  if (!failure || input.replaySteps.length === 0) throw new Error('Verified report requires replay and HTTP failure evidence');
  const finding: Finding = {
    expected: scrub(input.expected, enteredValues),
    actual: scrub(input.actual, enteredValues),
    screenshotPath: scrub(input.observation.screenshotPath, enteredValues),
    consoleErrors: input.observation.consoleErrors.map((error) => scrub(error, enteredValues)),
    httpFailures: input.observation.httpFailures.map(({ url, status }) => ({ url: cleanUrl(url), status })),
    trace: input.trace.map(({ action, outcome }) => ({ action: safeAction(action, enteredValues), outcome: scrub(outcome, enteredValues) })),
    replaySteps: input.replaySteps.map((action) => safeAction(action, enteredValues)),
    reproductionTest: reproductionTest(input.url, failure.url, input.replaySteps),
  };
  return {
    status: 'verified',
    trace: finding.trace,
    finding,
    markdown: `Verified finding\n\nExpected: ${finding.expected}\nActual: ${finding.actual}\nScreenshot: ${finding.screenshotPath}\nConsole: ${finding.consoleErrors.join(', ') || 'none'}\nHTTP: ${finding.httpFailures.map(({ url, status }) => `${status} ${url}`).join(', ')}\nTrace: ${finding.trace.map(({ action, outcome }) => `${action.type}${action.target ? ` ${action.target}` : ''} → ${outcome}`).join('; ')}\nReplay: ${finding.replaySteps.map(({ type, target }) => `${type}${target ? ` ${target}` : ''}`).join(' → ')}`,
  };
}
