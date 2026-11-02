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

export class MetaAdapter implements ReasoningAdapter {
  async decide(): Promise<Decision> {
    throw new Error('BLOCKED: Meta API contract and live smoke test are unverified');
  }
}
