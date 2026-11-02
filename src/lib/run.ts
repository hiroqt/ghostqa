import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createObserver } from './browser';
import type { ActionTrace, Decision, ProposedAction } from './contracts';
import { evaluateOutcome } from './evaluator';
import { authorizeAction, executeAction, installNetworkGuard } from './executor';
import { MetaAdapter, MockAdapter, type ReasoningAdapter } from './model';
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

// The mock drives the seeded fixture flow; the Meta adapter drives any
// authorized page. Live mode only matters for which origins the policy gate
// accepts (handled by the route); the loop invariants are identical.
function selectAdapter(url: string, goal: string): ReasoningAdapter {
  if (process.env.MODEL_MODE === 'meta') return new MetaAdapter();
  return new MockAdapter(demoDecisions(url, goal));
}

export async function runDemo(url: string, goal: string, emit: Emit): Promise<{ report: RunReport; screenshot?: string }> {
  const liveMode = process.env.ALLOW_LIVE_SITES === 'true';
  const origin = new URL(url).origin;
  const gate = { allowedOrigins: [origin], actionCount: 0, startedAt: Date.now(), liveMode };
  const evidenceDir = join(tmpdir(), 'ghostqa', randomUUID());
  let browser: Browser | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trace: ActionTrace[] = [];
  let adapter: ReasoningAdapter | undefined;
  let lastObservation: { dom: string; screenshotPath: string } | undefined;
  try {
    emit({ type: 'status', message: 'Launching local Chromium' });
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const activeBrowser = browser;
    timer = setTimeout(() => { void activeBrowser.close().catch(() => {}); }, Math.max(1, 60_000 - (Date.now() - gate.startedAt)));
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    await installNetworkGuard(context, gate.allowedOrigins, liveMode);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('download', (download) => { void download.cancel(); });
    page.on('dialog', (dialog) => { void dialog.dismiss(); });
    page.on('popup', (popup) => { void popup.close(); });
    async function perform(action: ProposedAction) {
      const entry: ActionTrace = { action, outcome: 'attempted' };
      trace.push(entry);
      gate.actionCount++;
      emit({ type: 'action', action: action.type, target: action.target ?? (action.type === 'navigate' ? action.value : '') });
      try {
        await executeAction(page, action);
        entry.outcome = 'completed';
      } catch (error) {
        entry.outcome = 'failed';
        throw error;
      }
    }

    const initial = authorizeAction({ type: 'navigate', value: url }, gate);
    await perform(initial);
    const observer = createObserver(page, origin, join(evidenceDir, 'latest.png'), liveMode);
    let observation = await observer.observe();
    lastObservation = { dom: observation.dom, screenshotPath: observation.screenshotPath };
    emit({ type: 'status', message: 'Observing page' });

    adapter = selectAdapter(url, goal);
    const steps: ProposedAction[] = [];
    // General observe -> decide -> execute -> evaluate loop. The action and time
    // budgets live in the gate (authorizeAction throws once either is spent), so
    // the loop simply runs until the model stops or a budget error is thrown.
    for (;;) {
      const decision = await adapter.decide({ observation, goal, priorTrace: trace });
      if (decision.kind === 'stop') {
        // A stop means the agent completed without reproducing a verified bug.
        // That is a no-finding by definition; a verified finding returns earlier.
        const suggestions = await adapter.suggestImprovements(observation.dom, observation.screenshotPath).catch(() => [] as string[]);
        const report = buildReport({ status: 'no-finding', reason: decision.reason, trace });
        return { report: { ...report, suggestions } };
      }
      const before = observation;
      const action = authorizeAction(decision.action, gate);
      await perform(action);
      steps.push(action);
      observation = await observer.observe();
      lastObservation = { dom: observation.dom, screenshotPath: observation.screenshotPath };

      const evaluation = evaluateOutcome({ expectedText: decision.expected, before, after: observation });
      // no-finding: the expectation held, keep driving toward the goal.
      if (evaluation.status === 'no-finding') continue;
      // inconclusive: no new HTTP failure to support a finding; keep going so the
      // model can try another step within budget rather than reporting a guess.
      if (evaluation.status === 'inconclusive') continue;

      // suspected: replay once from a fresh context before claiming anything.
      emit({ type: 'status', message: 'Replaying suspected failure once' });
      let replayEntry: ActionTrace | undefined;
      const replay = await replayOnce(browser, url, steps, gate, evidenceDir, (action, outcome) => {
        if (outcome === 'attempted') {
          replayEntry = { action, outcome: 'replay attempted' };
          trace.push(replayEntry);
          emit({ type: 'action', action: `replay ${action.type}`, target: action.target ?? (action.type === 'navigate' ? action.value : '') });
        } else if (replayEntry) replayEntry.outcome = `replay ${outcome}`;
      });
      const final = evaluateOutcome({ expectedText: decision.expected, before, after: observation, replay });
      if (final.status !== 'verified') {
        const suggestions = await adapter.suggestImprovements(observation.dom, observation.screenshotPath).catch(() => [] as string[]);
        const report = buildReport({ status: 'inconclusive', reason: 'Failure did not reproduce consistently', trace });
        return { report: { ...report, suggestions } };
      }
      const screenshot = `data:image/png;base64,${(await readFile(observation.screenshotPath)).toString('base64')}`;
      const report = buildReport({
        status: 'verified', url, expected: final.expected, actual: final.actual,
        observation: { ...observation, screenshotPath: 'inline screenshot evidence' }, trace, replaySteps: replay.replaySteps,
      });
      return { report, screenshot };
    }
  } catch (error) {
    const reason = Date.now() - gate.startedAt >= 60_000 ? 'Run timed out'
      : error instanceof Error && /^(Action limit reached|Replay exceeds action limit)$/.test(error.message) ? error.message
        : 'Run stopped safely; check the local fixture and Chromium';
    const suggestions = adapter
      ? await adapter.suggestImprovements(lastObservation?.dom ?? '', lastObservation?.screenshotPath ?? '').catch(() => [] as string[])
      : [];
    const report = buildReport({ status: 'inconclusive', reason, trace });
    return { report: { ...report, suggestions } };
  } finally {
    if (timer) clearTimeout(timer);
    await browser?.close().catch(() => {});
    await rm(evidenceDir, { recursive: true, force: true });
  }
}
