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
