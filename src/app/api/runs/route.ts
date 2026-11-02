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
  let input: z.infer<typeof runRequest>;
  let url: string;
  try {
    input = runRequest.parse(await request.json());
    url = assertAllowedUrl(input.url, (process.env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:3001').split(',').map((origin) => origin.trim()));
  } catch {
    return Response.json({ error: 'Only the configured local demo URL is allowed' }, { status: 400 });
  }
  if (process.env.MODEL_MODE && process.env.MODEL_MODE !== 'mock') {
    return Response.json({ error: 'Live Meta integration is not verified' }, { status: 503 });
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
