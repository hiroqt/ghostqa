import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { decisionSchema, type Decision, type DecisionContext } from './contracts';

export function parseDecision(raw: unknown): Decision {
  if (typeof raw === 'string') {
    if (raw.length > 8192) throw new Error('Model response too large');
    raw = JSON.parse(raw);
  }
  return decisionSchema.parse(raw);
}

export interface ReasoningAdapter {
  decide(context: DecisionContext): Promise<Decision>;
}

export class MockAdapter implements ReasoningAdapter {
  private index = 0;

  constructor(private readonly decisions: unknown[]) {}

  async decide(): Promise<Decision> {
    return parseDecision(this.decisions[this.index++] ?? { kind: 'stop', reason: 'Mock decisions exhausted' });
  }
}

const DEFAULT_BASE_URL = 'https://api.meta.ai/v1';
const DEFAULT_MODEL_ID = 'muse-spark-1.3';

// Minimal structural type for the parts of the OpenAI client we use. Keeping it
// narrow lets unit tests inject a mock without a real network client.
type ChatCompletionsClient = {
  chat: {
    completions: {
      create(params: unknown): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
};

export type MetaAdapterOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  client?: ChatCompletionsClient;
};

const SYSTEM_PROMPT = [
  'You are GhostQA, a cautious web QA agent driving one browser.',
  'You observe a sanitized DOM summary and, when available, a screenshot of the current page.',
  'Propose exactly ONE next step toward the goal, or stop.',
  'Reply with ONLY strict minified JSON, no prose, no markdown fences, matching one of:',
  '{"kind":"action","action":{"type":"navigate|click|fill|press|scroll|wait","target":"...","value":"..."},"expected":"the exact visible heading text you expect after this action","rationale":"why"}',
  'or {"kind":"stop","reason":"why you are stopping"}.',
  'Use "target" for the control label and "value" for navigation URLs, fill text, key names, scroll pixels, or wait milliseconds.',
  'The "expected" field must be the literal heading you expect to verify the outcome. Never include secrets or real credentials.',
].join('\n');

export class MetaAdapter implements ReasoningAdapter {
  private readonly client: ChatCompletionsClient;
  private readonly model: string;

  constructor(options: MetaAdapterOptions = {}) {
    const apiKey = options.apiKey ?? process.env.MODEL_API_KEY;
    this.model = options.model ?? process.env.MODEL_ID ?? DEFAULT_MODEL_ID;
    if (options.client) {
      this.client = options.client;
    } else {
      if (!apiKey) throw new Error('BLOCKED: MODEL_API_KEY is required for the Meta Model API adapter');
      this.client = new OpenAI({ baseURL: options.baseURL ?? DEFAULT_BASE_URL, apiKey }) as unknown as ChatCompletionsClient;
    }
  }

  async decide(context: DecisionContext): Promise<Decision> {
    const { observation, goal, priorTrace } = context;
    const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      {
        type: 'text',
        text: [
          `Goal: ${goal || '(none provided)'}`,
          `Prior actions: ${JSON.stringify(priorTrace)}`,
          `Console errors: ${JSON.stringify(observation.consoleErrors)}`,
          `HTTP failures: ${JSON.stringify(observation.httpFailures)}`,
          `Sanitized DOM: ${observation.dom}`,
        ].join('\n'),
      },
    ];

    // Image input is optional: attach the screenshot only when the file exists,
    // otherwise fall back to the always-present sanitized DOM text.
    try {
      const bytes = await readFile(observation.screenshotPath);
      parts.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` } });
    } catch { /* No screenshot available; proceed text-only. */ }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parts },
      ],
    });

    // Treat the model response as untrusted: it must pass the 8KB cap and the
    // strict schema before it can ever reach the policy gate or the browser.
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Meta Model API returned no text content');
    return parseDecision(content);
  }
}
