import { join } from 'node:path';
import type { Browser } from 'playwright';
import { createObserver } from './browser';
import type { Observation, ProposedAction } from './contracts';
import { authorizeAction, executeAction, installNetworkGuard } from './executor';
import { assertAllowedUrl } from './policy';

type RunGate = { allowedOrigins: readonly string[]; actionCount: number; startedAt: number };

export async function replayOnce(
  browser: Browser,
  initialUrl: string,
  actions: readonly ProposedAction[],
  gate: RunGate,
  evidenceDir: string,
  onAction?: (action: ProposedAction, outcome: 'attempted' | 'completed' | 'failed') => void,
): Promise<{ before: Observation; after: Observation; replaySteps: ProposedAction[] }> {
  if (actions.length === 0) throw new Error('No action to replay');
  const url = assertAllowedUrl(initialUrl, gate.allowedOrigins);
  const navigation = authorizeAction({ type: 'navigate', value: url }, gate);
  if (gate.actionCount + actions.length >= 10) throw new Error('Replay exceeds action limit');

  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
  const remaining = Math.max(1, 60_000 - (Date.now() - gate.startedAt));
  const timer = setTimeout(() => { void context.close().catch(() => {}); }, remaining);
  try {
    await installNetworkGuard(context, gate.allowedOrigins);
    const page = await context.newPage();
    async function perform(action: ProposedAction) {
      onAction?.(action, 'attempted');
      gate.actionCount++;
      try {
        await executeAction(page, action);
        onAction?.(action, 'completed');
      } catch (error) {
        onAction?.(action, 'failed');
        throw error;
      }
    }
    page.on('download', (download) => { void download.cancel(); });
    page.on('dialog', (dialog) => { void dialog.dismiss(); });
    const origin = new URL(url).origin;
    const beforeObserver = createObserver(page, origin, join(evidenceDir, 'replay-before.png'));
    const afterObserver = createObserver(page, origin, join(evidenceDir, 'replay-after.png'));
    authorizeAction(navigation, gate);
    await perform(navigation);

    const replaySteps = [navigation];
    let before: Observation | undefined;
    for (const [index, raw] of actions.entries()) {
      const action = authorizeAction(raw, gate);
      if (index === actions.length - 1) before = await beforeObserver.observe();
      await perform(action);
      replaySteps.push(action);
    }
    if (!before) throw new Error('Missing replay baseline');
    return { before, after: await afterObserver.observe(), replaySteps };
  } finally {
    clearTimeout(timer);
    await context.close();
  }
}
