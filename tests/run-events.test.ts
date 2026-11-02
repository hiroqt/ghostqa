import { expect, test } from 'vitest';
import { describeLiveEvaluation, readRunEvents } from '../src/lib/run-events';

test('reads newline-delimited events split across network chunks', async () => {
  const chunks = ['{"type":"status","message":"Run', 'ning"}\n{"type":"done"}\n'];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const events: unknown[] = [];
  await readRunEvents(stream, (event) => events.push(event));
  expect(events).toEqual([{ type: 'status', message: 'Running' }, { type: 'done' }]);
});

test('reads multiple bounded screenshot events delivered in one chunk', async () => {
  const line = JSON.stringify({ type: 'observation', screenshot: 'a'.repeat(700_000) }) + '\n';
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(line + line));
      controller.close();
    },
  });
  let count = 0;
  await readRunEvents(stream, () => { count++; });
  expect(count).toBe(2);
});

test('describes live evaluation where and what dynamically from actions and status', () => {
  const fillDesc = describeLiveEvaluation({
    mode: 'test',
    url: 'http://127.0.0.1:3001/register',
    status: 'Evaluating outcome',
    log: ['navigate http://127.0.0.1:3001/register', 'fill Email', 'click Create account'],
  });
  expect(fillDesc.headline).toContain('Create account');
  expect(fillDesc.where).toContain('Create account');
  expect(fillDesc.what).toMatch(/heading|HTTP|console/i);

  const replayDesc = describeLiveEvaluation({
    mode: 'test',
    url: 'http://127.0.0.1:3001/register',
    status: 'Replaying suspected failure once',
    log: ['navigate http://127.0.0.1:3001/register', 'replay click Create account'],
  });
  expect(replayDesc.headline).toMatch(/Replaying/i);
  expect(replayDesc.where).toContain('Create account');
  expect(replayDesc.what).toMatch(/fresh browser context/i);

  const slopDesc = describeLiveEvaluation({
    mode: 'slop',
    url: 'http://127.0.0.1:3001/slop',
    status: 'Measuring rendered design',
    log: ['navigate http://127.0.0.1:3001/slop'],
  });
  expect(slopDesc.headline).toBe('Analyzing page design');
  expect(slopDesc.what).toMatch(/computed styles|palette|card|typography/i);

  const initialNavDesc = describeLiveEvaluation({
    mode: 'test',
    url: 'http://127.0.0.1:3001/register',
    status: 'Starting',
    log: ['navigate http://127.0.0.1:3001/register'],
  });
  expect(initialNavDesc.headline).toMatch(/Navigating|Validating/i);
  expect(initialNavDesc.headline).not.toBe(
    describeLiveEvaluation({
      mode: 'test',
      url: 'http://127.0.0.1:3001/register',
      status: 'Observing page',
      log: ['navigate http://127.0.0.1:3001/register'],
    }).headline,
  );
  expect(
    describeLiveEvaluation({
      mode: 'test',
      url: 'http://127.0.0.1:3001/register',
      status: 'Evaluating outcome',
      log: ['navigate http://127.0.0.1:3001/register'],
    }).headline,
  ).toMatch(/Evaluating/i);
});
