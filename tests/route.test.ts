import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// Mock the run loop so route tests exercise URL policy + allowlist wiring only,
// never launching a real browser against a public origin.
const runDemo = vi.fn(async (_url: string, _goal: string, emit: (event: Record<string, unknown>) => void, _mode?: 'test' | 'slop' | 'technical') => {
  void _mode;
  emit({ type: 'done', report: { status: 'no-finding' } });
  return { report: { status: 'no-finding' } } as never;
});
vi.mock('../src/lib/run', () => ({ runDemo: (...args: Parameters<typeof runDemo>) => runDemo(...args) }));

const { POST } = await import('../src/app/api/runs/route');

const originalEnv = { ...process.env };

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function drain(response: Response): Promise<void> {
  // Consume the stream so the background run settles and releases the run lock.
  if (response.body) await new Response(response.body).text();
}

beforeEach(() => {
  runDemo.mockClear();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

test('rejects an external URL before launching a browser (live mode off)', async () => {
  delete process.env.ALLOW_LIVE_SITES;
  const response = await POST(makeRequest({ url: 'https://example.com', goal: 'Register' }));
  expect(response.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();
});

test('live mode allows public URLs only for read-only reviews', async () => {
  process.env.ALLOW_LIVE_SITES = 'true';
  delete process.env.ALLOWED_ORIGINS;
  const functional = await POST(makeRequest({ url: 'https://example.com/pricing', mode: 'test' }));
  expect(functional.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();

  const response = await POST(makeRequest({ url: 'https://example.com/pricing', mode: 'slop' }));
  expect(response.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('https://example.com/pricing', '', expect.any(Function), 'slop');
  await drain(response);
});

test.each([
  'http://localhost:8080/',
  'http://127.0.0.1/',
  'http://10.0.0.5/',
  'http://169.254.169.254/latest/meta-data',
  'http://[::1]/',
  'http://[fc00::1]/',
])('live mode rejects private/internal target %s', async (url) => {
  process.env.ALLOW_LIVE_SITES = 'true';
  delete process.env.ALLOWED_ORIGINS;
  const response = await POST(makeRequest({ url }));
  expect(response.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();
});

test('live mode rejects unsafe schemes and credentialed URLs', async () => {
  process.env.ALLOW_LIVE_SITES = 'true';
  delete process.env.ALLOWED_ORIGINS;
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.com/x']) {
    const response = await POST(makeRequest({ url }));
    expect(response.status).toBe(400);
  }
  expect(runDemo).not.toHaveBeenCalled();
});

test('live mode off still requires and uses ALLOWED_ORIGINS loopback default', async () => {
  delete process.env.ALLOW_LIVE_SITES;
  delete process.env.ALLOWED_ORIGINS;
  const ok = await POST(makeRequest({ url: 'http://127.0.0.1:3001/register' }));
  expect(ok.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('http://127.0.0.1:3001/register', '', expect.any(Function), 'test');
  await drain(ok);
});

test('routes only the selected review mode to the run controller', async () => {
  const response = await POST(makeRequest({ url: 'http://127.0.0.1:3001/slop', mode: 'slop' }));
  expect(response.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('http://127.0.0.1:3001/slop', '', expect.any(Function), 'slop');
  await drain(response);
  runDemo.mockClear();
  const invalid = await POST(makeRequest({ url: 'http://127.0.0.1:3001/slop', mode: 'unknown' }));
  expect(invalid.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();
});

test('slop review admits a public URL only in live mode', async () => {
  process.env.ALLOW_LIVE_SITES = 'true';
  const response = await POST(makeRequest({ url: 'https://example.com/', mode: 'slop' }));
  expect(response.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('https://example.com/', '', expect.any(Function), 'slop');
  await drain(response);
  runDemo.mockClear();
  const privateResponse = await POST(makeRequest({ url: 'http://127.0.0.1:8080/', mode: 'slop' }));
  expect(privateResponse.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();
});

test('technical review routes through the same admitted origin', async () => {
  const response = await POST(makeRequest({ url: 'http://127.0.0.1:3001/slop', mode: 'technical' }));
  expect(response.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('http://127.0.0.1:3001/slop', '', expect.any(Function), 'technical');
  await drain(response);
});

test('technical review admits one public origin only in explicit live mode', async () => {
  process.env.ALLOW_LIVE_SITES = 'true';
  const response = await POST(makeRequest({ url: 'https://example.com/', mode: 'technical' }));
  expect(response.status).toBe(200);
  expect(runDemo).toHaveBeenCalledWith('https://example.com/', '', expect.any(Function), 'technical');
  await drain(response);
  runDemo.mockClear();
  const privateResponse = await POST(makeRequest({ url: 'http://127.0.0.1:8080/', mode: 'technical' }));
  expect(privateResponse.status).toBe(400);
  expect(runDemo).not.toHaveBeenCalled();
});

test('client cancellation does not leave the run locked or close the stream twice', async () => {
  let finish: (() => void) | undefined;
  runDemo.mockImplementationOnce(async (_url, _goal, emit) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    emit({ type: 'status', message: 'Late result' });
    return { report: { status: 'no-finding' } } as never;
  });
  const response = await POST(makeRequest({ url: 'http://127.0.0.1:3001/health' }));
  await response.body?.cancel();
  finish?.();
  await vi.waitFor(async () => {
    const next = await POST(makeRequest({ url: 'http://127.0.0.1:3001/health' }));
    expect(next.status).toBe(200);
    await drain(next);
  });
});
