import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Server } from 'node:http';
import { createDemoServer } from '../fixtures/demo/server.mjs';

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createDemoServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture did not bind to a TCP port');
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('serves a labeled registration form and deterministic failure', async () => {
  const form = await fetch(`${origin}/register`);
  const html = await form.text();
  expect(form.status).toBe(200);
  expect(html).toContain('<label for="email">Email</label>');
  expect(html).toContain('<label for="password">Password</label>');
  expect(html).toContain('action="/register" method="post"');

  const values = new URLSearchParams({ email: 'demo@example.test', password: 'synthetic-password' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${origin}/register`, { method: 'POST', body: values });
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Registration failed');
  }
});

test('serves a healthy flow', async () => {
  const response = await fetch(`${origin}/health`);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Demo is ready');
});
