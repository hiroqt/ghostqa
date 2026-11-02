import { z } from 'zod';
import { assertAllowedUrl } from '../../../lib/policy';

export const runtime = 'nodejs';

const runRequest = z.strictObject({
  url: z.string().max(2048),
  goal: z.string().max(200).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let input: z.infer<typeof runRequest>;
  try {
    input = runRequest.parse(await request.json());
    assertAllowedUrl(input.url, (process.env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:3001').split(','));
  } catch {
    return Response.json({ error: 'Only the configured local demo URL is allowed' }, { status: 400 });
  }
  return Response.json({ error: 'Run controller is not ready' }, { status: 501 });
}
