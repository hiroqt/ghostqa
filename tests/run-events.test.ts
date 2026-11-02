import { expect, test } from 'vitest';
import { readRunEvents } from '../src/lib/run-events';

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
