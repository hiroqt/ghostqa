import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { decisionSchema, type Decision, type DecisionContext, type Suggestion } from './contracts';

export function parseDecision(raw: unknown): Decision {
  if (typeof raw === 'string') {
    if (raw.length > 8192) throw new Error('Model response too large');
    raw = JSON.parse(raw);
  }
  return decisionSchema.parse(raw);
}

export interface ReasoningAdapter {
  decide(context: DecisionContext): Promise<Decision>;
  suggestImprovements(dom: string, screenshotPath: string): Promise<Suggestion[]>;
}

export class MockAdapter implements ReasoningAdapter {
  private index = 0;

  constructor(private readonly decisions: unknown[]) {}

  async decide(): Promise<Decision> {
    return parseDecision(this.decisions[this.index++] ?? { kind: 'stop', reason: 'Mock decisions exhausted' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async suggestImprovements(_dom: string, _screenshotPath: string): Promise<Suggestion[]> {
    return [
      {
        text: 'Add ARIA landmark roles to major sections for better screen reader navigation',
        reason: 'Landmarks help screen reader users move between major page regions.',
        selector: 'header, main, footer',
        location: '<header> / <main>',
        codeSnippet: '<header role="banner">\n  <nav role="navigation" aria-label="Primary">\n    ...\n  </nav>\n</header>',
      },
      {
        text: 'Ensure all images have descriptive alt attributes',
        reason: 'Alternative text conveys the image meaning when it cannot be seen.',
        selector: 'img:not([alt]), img[alt=""]',
        location: '<img>',
        codeSnippet: '<!-- before -->\n<img src="hero.png">\n\n<!-- after -->\n<img src="hero.png" alt="Homepage hero illustration showing dashboard">',
      },
      {
        text: 'Consider lazy-loading below-the-fold images to improve initial page load performance',
        reason: 'Deferring offscreen images can reduce initial network work.',
        selector: 'img',
        location: '<img> (below fold)',
        codeSnippet: '<img src="photo.jpg" alt="..." loading="lazy" width="800" height="600">',
      },
    ];
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

  async suggestImprovements(dom: string, screenshotPath: string): Promise<Suggestion[]> {
    try {
      const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
        {
          type: 'text',
          text: [
            'You are a web quality advisor. Analyze the following sanitized DOM and screenshot.',
            'Return a JSON array of 3 to 5 improvement objects, each with these exact keys:',
            '  text       — concise description of the improvement (string)',
            '  reason     — why this matters based on visible evidence (string)',
            '  selector   — CSS selector or element path pointing to the affected element (string)',
            '  location   — short label for the UI chip, e.g. "nav > a" or "<img>" (string)',
            '  codeSnippet — a short before/after HTML or CSS snippet illustrating the fix (string, may be empty)',
            'Cover UX, accessibility, performance patterns, and code structure.',
            'Reply with ONLY a minified JSON array, no prose, no markdown fences.',
            'Example: [{"text":"Add alt text","selector":"img","location":"<img>","codeSnippet":"<img src=\\"x\\" alt=\\"desc\\">"}]',
            '',
            `Sanitized DOM: ${dom.slice(0, 4000)}`,
          ].join('\n'),
        },
      ];
      try {
        const bytes = await readFile(screenshotPath);
        parts.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` } });
      } catch { /* no screenshot; proceed text-only */ }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: parts }],
      });
      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return [];
      const parsed: unknown = JSON.parse(content.trim());
      if (!Array.isArray(parsed)) return [];
      return (parsed as unknown[])
        .filter((s): s is Suggestion =>
          typeof s === 'object' && s !== null &&
          'text' in s && typeof (s as { text: unknown }).text === 'string' &&
          'selector' in s && typeof (s as { selector: unknown }).selector === 'string' &&
          'location' in s && typeof (s as { location: unknown }).location === 'string' &&
          'codeSnippet' in s && typeof (s as { codeSnippet: unknown }).codeSnippet === 'string' &&
          (!('reason' in s) || typeof (s as { reason: unknown }).reason === 'string'),
        )
        .slice(0, 5);
    } catch {
      return [];
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
