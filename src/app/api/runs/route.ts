import { z } from 'zod';
import { assertAllowedUrl } from '../../../lib/policy';
import { runDemo } from '../../../lib/run';

export const runtime = 'nodejs';
export const maxDuration = 60;

let running = false;

const runRequest = z.strictObject({
  url: z.string().max(2048),
  goal: z.string().max(200).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const modelMode = process.env.MODEL_MODE ?? 'mock';
  if (modelMode !== 'mock' && modelMode !== 'meta') {
    return Response.json({ error: 'Unknown MODEL_MODE' }, { status: 503 });
  }
  const liveMode = process.env.ALLOW_LIVE_SITES === 'true';
  // Live mode builds the allowlist from ALLOWED_ORIGINS (public origins allowed);
  // the safe default stays loopback-only when live mode is off.
  const defaultOrigins = liveMode ? '' : 'http://127.0.0.1:3001';
  let input: z.infer<typeof runRequest>;
  let url: string;
  try {
    input = runRequest.parse(await request.json());
    const origins = (process.env.ALLOWED_ORIGINS ?? defaultOrigins).split(',').map((origin) => origin.trim()).filter(Boolean);
    url = assertAllowedUrl(input.url, origins, { liveMode });
  } catch {
    const message = liveMode ? 'Only an allowlisted origin is allowed' : 'Only the configured local demo URL is allowed';
    return Response.json({ error: message }, { status: 400 });
  }
  if (running) return Response.json({ error: 'A run is already active' }, { status: 409 });
  running = true;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      void runDemo(url, input.goal ?? '', emit)
        .then(({ report, screenshot }) => emit({ type: 'done', report, screenshot }))
        .catch((error: unknown) => {
          const message = error instanceof Error && /^(Action limit reached|Run timed out|Replay exceeds action limit)$/.test(error.message)
            ? error.message : 'Run stopped safely; check the local fixture and Chromium';
          emit({ type: 'error', message });
        })
        .finally(() => { running = false; controller.close(); });
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
