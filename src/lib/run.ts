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
import { reviewSlopPatterns, type DeliveredSource } from './slop-review';

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

export async function runDemo(url: string, goal: string, emit: Emit, mode: 'test' | 'slop' = 'test'): Promise<{ report: RunReport; screenshot?: string; highlight?: { x: number; y: number; width: number; height: number } }> {
  const liveMode = process.env.ALLOW_LIVE_SITES === 'true';
  const origin = new URL(url).origin;
  const gate = { allowedOrigins: [origin], actionCount: 0, startedAt: Date.now(), liveMode };
  const evidenceDir = join(tmpdir(), 'ghostqa', randomUUID());
  let browser: Browser | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trace: ActionTrace[] = [];
  let adapter: ReasoningAdapter | undefined;
  let lastObservation: { dom: string; screenshotPath: string } | undefined;
  async function locateSuggestions(items: import('./contracts').Suggestion[], path: string, page: import('playwright').Page) {
    const image = await readFile(path).catch(() => null);
    const viewport = page.viewportSize();
    if (!image || image.length > 500_000 || !viewport) return items;
    return Promise.all(items.map(async (item) => {
      if (!item.selector || item.selector.length > 200) return item;
      const box = await page.locator(item.selector).first().boundingBox({ timeout: 500 }).catch(() => null);
      if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) return item;
      return { ...item, image: `data:image/png;base64,${image.toString('base64')}`, bounds: { x: box.x / viewport.width * 100, y: box.y / viewport.height * 100, width: box.width / viewport.width * 100, height: box.height / viewport.height * 100 } };
    }));
  }
  async function emitObservation(path: string): Promise<boolean> {
    const image = await readFile(path);
    // shortcut: cap streamed images at 500 KB; add resizing if the review JPEG fallback also exceeds it.
    if (image.length > 500_000) return false;
    emit({ type: 'observation', screenshot: `data:image/png;base64,${image.toString('base64')}` });
    return true;
  }
  try {
    emit({ type: 'status', message: 'Launching Chromium' });
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
    const activeBrowser = browser;
    timer = setTimeout(() => { void activeBrowser.close().catch(() => {}); }, Math.max(1, 60_000 - (Date.now() - gate.startedAt)));
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    await installNetworkGuard(context, gate.allowedOrigins, liveMode, mode === 'slop');
    const page = await context.newPage();
    const delivered: Promise<DeliveredSource | null>[] = [];
    if (mode === 'slop') page.on('response', (response) => {
      const resourceUrl = new URL(response.url());
      const type = response.headers()['content-type'] ?? '';
      const size = Number(response.headers()['content-length'] ?? 0);
      if (resourceUrl.origin !== origin || response.status() >= 400 || size > 200_000) return;
      const kind: DeliveredSource['kind'] | null = /text\/html/i.test(type) ? 'html' : /text\/css/i.test(type) ? 'css' : /(?:javascript|ecmascript)/i.test(type) ? 'js' : null;
      if (kind && delivered.length < 20) delivered.push(response.text().then((text) => text.length <= 200_000 ? { kind, text } : null).catch(() => null));
    });
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
    const previewSent = await emitObservation(observation.screenshotPath);
    emit({ type: 'status', message: 'Observing page' });

    if (mode === 'slop') {
      if (!previewSent) {
        const image = await page.screenshot({ type: 'jpeg', quality: 45, mask: [page.locator('input,textarea,select,[data-private]')], animations: 'disabled' });
        if (image.length <= 500_000) emit({ type: 'observation', screenshot: `data:image/jpeg;base64,${image.toString('base64')}` });
      }
      emit({ type: 'status', message: 'Reviewing delivered source' });
      await page.waitForLoadState('load', { timeout: 3_000 }).catch(() => {});
      const sources = (await Promise.all(delivered)).filter((source): source is DeliveredSource => source !== null);
      if (!sources.some((source) => source.kind === 'html')) sources.push({ kind: 'html', text: (await page.content()).slice(0, 200_000) });
      const review = reviewSlopPatterns(sources);
      const base = buildReport({ status: 'no-finding', reason: 'Design and code review completed', trace });
      return { report: {
        ...base,
        status: review.status === 'story' ? 'review' : 'insufficient-evidence',
        markdown: review.status === 'story' ? 'Source-backed design and code observations; patterns do not prove AI authorship.' : 'Insufficient evidence for a findings story.',
        slopReview: review,
      } };
    }

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
        const suggestions = await adapter.suggestImprovements(observation.dom, observation.screenshotPath).catch(() => [] as import('./contracts').Suggestion[]);
        const report = buildReport({ status: 'no-finding', reason: decision.reason, trace });
        return { report: { ...report, suggestions: await locateSuggestions(suggestions, observation.screenshotPath, page) } };
      }
      const before = observation;
      const action = authorizeAction(decision.action, gate);
      await perform(action);
      steps.push(action);
      observation = await observer.observe();
      lastObservation = { dom: observation.dom, screenshotPath: observation.screenshotPath };
      await emitObservation(observation.screenshotPath);

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
        const suggestions = await adapter.suggestImprovements(observation.dom, observation.screenshotPath).catch(() => [] as import('./contracts').Suggestion[]);
        const report = buildReport({ status: 'inconclusive', reason: 'Failure did not reproduce consistently', trace });
        return { report: { ...report, suggestions: await locateSuggestions(suggestions, observation.screenshotPath, page) } };
      }
      const screenshot = `data:image/png;base64,${(await readFile(observation.screenshotPath)).toString('base64')}`;
      const box = await page.getByRole('heading', { name: final.actual, exact: true }).first().boundingBox().catch(() => null);
      const viewport = page.viewportSize();
      const highlight = box && viewport && box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height
        ? { x: box.x / viewport.width * 100, y: box.y / viewport.height * 100, width: box.width / viewport.width * 100, height: box.height / viewport.height * 100 }
        : undefined;
      const report = buildReport({
        status: 'verified', url, expected: final.expected, actual: final.actual,
        observation: { ...observation, screenshotPath: 'inline screenshot evidence' }, trace, replaySteps: replay.replaySteps,
      });
      return { report, screenshot, highlight };
    }
  } catch (error) {
    const reason = Date.now() - gate.startedAt >= 60_000 ? 'Run timed out'
      : error instanceof Error && /^(Action limit reached|Replay exceeds action limit)$/.test(error.message) ? error.message
        : 'Run stopped safely; check the local fixture and Chromium';
    const suggestions = adapter
      ? await adapter.suggestImprovements(lastObservation?.dom ?? '', lastObservation?.screenshotPath ?? '').catch(() => [] as import('./contracts').Suggestion[])
      : [];
    const report = buildReport({ status: 'inconclusive', reason, trace });
    return { report: { ...report, suggestions } };
  } finally {
    if (timer) clearTimeout(timer);
    await browser?.close().catch(() => {});
    await rm(evidenceDir, { recursive: true, force: true });
  }
}
