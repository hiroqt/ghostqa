import { expect, test } from 'vitest';
import { POST } from '../src/app/api/runs/route';

test('rejects an external URL before launching a browser', async () => {
  const response = await POST(new Request('http://localhost/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com', goal: 'Register' }),
  }));
  expect(response.status).toBe(400);
});
