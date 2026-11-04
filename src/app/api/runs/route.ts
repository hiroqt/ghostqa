import { z } from 'zod';
import { assertAllowedUrl, assertLiveUrl } from '../../../lib/policy';
import { runDemo } from '../../../lib/run';

export const runtime = 'nodejs';
export const maxDuration = 60;

let running = false;

const runRequest = z.strictObject({
  url: z.string().max(2048),
  goal: z.string().max(200).optional(),
  mode: z.enum(['test', 'slop', 'technical']).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const modelMode = process.env.MODEL_MODE ?? 'mock';
  const liveMode = process.env.ALLOW_LIVE_SITES === 'true';
  if (modelMode !== 'mock' && modelMode !== 'meta') {
    return Response.json({ error: 'Unknown MODEL_MODE' }, { status: 503 });
  }
  let input: z.infer<typeof runRequest>;
  let url: string;
  let publicReview = false;
  try {
    input = runRequest.parse(await request.json());
    publicReview = liveMode && (input.mode ?? 'test') !== 'test';
    if (publicReview) {
      // Live mode: the per-run allowlist is derived from the submitted URL's
      // origin for the read-only review modes. ALLOWED_ORIGINS is not required;
      // private/internal hosts are rejected (SSRF), and the run stays on-origin.
      url = assertLiveUrl(input.url).url;
    } else {
      // Functional runs always use the configured loopback demo allowlist.
      const origins = (process.env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:3001')
        .split(',').map((origin) => origin.trim()).filter(Boolean);
      url = assertAllowedUrl(input.url, origins);
    }
  } catch (err) {
    const code = err instanceof Error ? (err as { code?: string }).code ?? err.message : String(err);
    const message = publicReview
      ? `Enter a valid public URL (https://example.com). Private and internal addresses are not allowed. [${code}]`
      : 'This website URL is not enabled for this run.';
    return Response.json({ error: message }, { status: 400 });
  }
  if (running) return Response.json({ error: 'A run is already active' }, { status: 409 });
  running = true;
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: Record<string, unknown>) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      void runDemo(url, input.goal ?? '', emit, input.mode ?? 'test')
        .then(({ report, screenshot, highlight }) => emit({ type: 'done', report, screenshot, highlight }))
        .catch((error: unknown) => {
          const message = error instanceof Error && /^(Action limit reached|Run timed out|Replay exceeds action limit)$/.test(error.message)
            ? error.message : 'Run stopped safely; check the website and browser availability';
          emit({ type: 'error', message });
        })
        .finally(() => { running = false; if (!cancelled) controller.close(); });
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
