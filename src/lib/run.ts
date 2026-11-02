import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createObserver } from './browser';
import type { ActionTrace, Decision, ProposedAction } from './contracts';
import { evaluateOutcome } from './evaluator';
import { authorizeAction, executeAction, installNetworkGuard } from './executor';
import { MockAdapter, type ReasoningAdapter } from './model';
import { replayOnce } from './replay';
import { buildReport, type RunReport } from './report';

type Emit = (event: Record<string, unknown>) => void;

function demoDecisions(url: string, goal: string): Decision[] {
  const path = new URL(url).pathname;
  if (path === '/health') return [{ kind: 'stop', reason: 'Healthy page observed' }];
  if (!['/', '/register'].includes(path) || (goal && !/register|sign.?up/i.test(goal))) {
    return [{ kind: 'stop', reason: 'The mock supports registration and health demo flows only' }];
  }
  const actions: { action: ProposedAction; expected: string }[] = [];
  if (path === '/') actions.push({ action: { type: 'navigate', value: `${new URL(url).origin}/register` }, expected: 'Register' });
  actions.push(
    { action: { type: 'fill', target: 'Email', value: 'demo@example.test' }, expected: 'Register' },
    { action: { type: 'fill', target: 'Password', value: 'synthetic-password' }, expected: 'Register' },
    { action: { type: 'click', target: 'Create account' }, expected: 'Registration complete' },
  );
  return actions.map(({ action, expected }) => ({ kind: 'action', action, expected, rationale: 'Exercise the seeded registration flow' }));
}

export async function runDemo(url: string, goal: string, emit: Emit): Promise<{ report: RunReport; screenshot?: string }> {
  const origin = new URL(url).origin;
  const gate = { allowedOrigins: [origin], actionCount: 0, startedAt: Date.now() };
  const evidenceDir = join(tmpdir(), 'ghostqa', randomUUID());
  let browser: Browser | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trace: ActionTrace[] = [];
  try {
    emit({ type: 'status', message: 'Launching local Chromium' });
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const activeBrowser = browser;
    timer = setTimeout(() => { void activeBrowser.close().catch(() => {}); }, Math.max(1, 60_000 - (Date.now() - gate.startedAt)));
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    await installNetworkGuard(context, gate.allowedOrigins);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('download', (download) => { void download.cancel(); });
    page.on('dialog', (dialog) => { void dialog.dismiss(); });
    page.on('popup', (popup) => { void popup.close(); });

    const initial = authorizeAction({ type: 'navigate', value: url }, gate);
    gate.actionCount++;
    await executeAction(page, initial);
    const observer = createObserver(page, origin, join(evidenceDir, 'latest.png'));
    let observation = await observer.observe();
    emit({ type: 'status', message: 'Observing local page' });

    const adapter: ReasoningAdapter = new MockAdapter(demoDecisions(url, goal));
    const steps: ProposedAction[] = [];
    for (;;) {
      const decision = await adapter.decide({ observation, goal, priorTrace: trace });
      if (decision.kind === 'stop') {
        const expected = new URL(url).pathname === '/health' ? 'Demo is ready' : '';
        const status = expected && evaluateOutcome({ expectedText: expected, before: observation, after: observation }).status === 'no-finding'
          ? 'no-finding' : 'inconclusive';
        return { report: buildReport({ status, reason: decision.reason, trace }) };
      }
      const before = observation;
      const action = authorizeAction(decision.action, gate);
      gate.actionCount++;
      emit({ type: 'action', action: action.type, target: action.target ?? '', message: decision.rationale });
      await executeAction(page, action);
      steps.push(action);
      trace.push({ action, outcome: 'completed' });
      observation = await observer.observe();
      if (decision.expected !== 'Registration complete') continue;

      const suspected = evaluateOutcome({ expectedText: decision.expected, before, after: observation });
      if (suspected.status !== 'suspected') {
        return { report: buildReport({ status: suspected.status === 'no-finding' ? 'no-finding' : 'inconclusive', reason: suspected.actual, trace }) };
      }
      emit({ type: 'status', message: 'Replaying suspected failure once' });
      const replay = await replayOnce(browser, url, steps, gate, evidenceDir);
      const final = evaluateOutcome({ expectedText: decision.expected, before, after: observation, replay });
      if (final.status !== 'verified') {
        return { report: buildReport({ status: 'inconclusive', reason: 'Failure did not reproduce consistently', trace }) };
      }
      const screenshot = `data:image/png;base64,${(await readFile(observation.screenshotPath)).toString('base64')}`;
      const report = buildReport({
        status: 'verified', url, expected: final.expected, actual: final.actual,
        observation: { ...observation, screenshotPath: 'inline screenshot evidence' }, trace, replaySteps: replay.replaySteps,
      });
      return { report, screenshot };
    }
  } finally {
    if (timer) clearTimeout(timer);
    await browser?.close().catch(() => {});
    await rm(evidenceDir, { recursive: true, force: true });
  }
}
