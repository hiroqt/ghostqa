// Live smoke test for the Meta Model API (Muse) via the OpenAI-compatible SDK.
// Requires a real MODEL_API_KEY and network access. Never prints the key.
import OpenAI from 'openai';

const apiKey = process.env.MODEL_API_KEY;
const baseURL = process.env.MODEL_BASE_URL ?? 'https://api.meta.ai/v1';
const model = process.env.MODEL_ID ?? 'muse-spark-1.3';

if (!apiKey) {
  console.error('NOT RUN: set MODEL_API_KEY to run the live Meta Model API smoke test.');
  process.exit(2);
}

// A 1x1 transparent PNG, to confirm the multimodal image_url content item is accepted.
const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pL+AAAAAElFTkSuQmCC';

const client = new OpenAI({ baseURL, apiKey });

try {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Reply with a single short word.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Reply with the word: ok' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${tinyPng}` } },
        ],
      },
    ],
  });

  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    console.error('FAIL: Meta Model API response did not contain text content.');
    process.exit(1);
  }
  console.log(`OK: Meta Model API (${model}) returned a well-formed response (${content.length} chars).`);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: Meta Model API smoke test errored: ${message}`);
  process.exit(1);
}
