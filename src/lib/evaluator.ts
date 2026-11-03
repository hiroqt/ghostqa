import type { Observation } from './contracts';

type OutcomeStatus = 'no-finding' | 'suspected' | 'verified' | 'inconclusive';
type Replay = { before: Observation; after: Observation };

export type Evaluation = {
  status: OutcomeStatus;
  expected: string;
  actual: string;
  httpFailure?: Observation['httpFailures'][number];
};

function headings(observation: Observation): string[] | null {
  try {
    const parsed: unknown = JSON.parse(observation.dom);
    if (!parsed || typeof parsed !== 'object' || !('headings' in parsed)) return null;
    const value = parsed.headings;
    return Array.isArray(value) && value.every((heading) => typeof heading === 'string') ? value : null;
  } catch {
    return null;
  }
}

function newHttpFailure(before: Observation, after: Observation) {
  const previous = new Map<string, number>();
  for (const failure of before.httpFailures) {
    const key = `${failure.status} ${failure.url}`;
    previous.set(key, (previous.get(key) ?? 0) + 1);
  }
  return after.httpFailures.find((failure) => {
    const key = `${failure.status} ${failure.url}`;
    const count = previous.get(key) ?? 0;
    if (count) {
      previous.set(key, count - 1);
      return false;
    }
    // Browser favicon probes are not application behavior and must never be bug evidence.
    return failure.status >= 400 && !/\/favicon\.ico$/i.test(failure.url);
  });
}

export function evaluateOutcome(input: { expectedText: string; before: Observation; after: Observation; replay?: Replay }): Evaluation {
  const { expectedText, before, after, replay } = input;
  const observedHeadings = headings(after);
  const base = { expected: expectedText, actual: observedHeadings?.[0] ?? 'No visible heading' };
  if (!expectedText.trim() || !observedHeadings) return { ...base, status: 'inconclusive' };
  if (observedHeadings.includes(expectedText)) return { ...base, actual: expectedText, status: 'no-finding' };

  const failure = newHttpFailure(before, after);
  if (!failure) return { ...base, status: 'inconclusive' };
  if (!replay) return { ...base, status: 'suspected', httpFailure: failure };

  const replayHeadings = headings(replay.after);
  const replayFailure = newHttpFailure(replay.before, replay.after);
  if (!replayHeadings || replayHeadings.includes(expectedText) || (replayHeadings[0] ?? 'No visible heading') !== base.actual ||
      !replayFailure || replayFailure.url !== failure.url || replayFailure.status !== failure.status) {
    return { ...base, status: 'inconclusive', httpFailure: failure };
  }
  return { ...base, status: 'verified', httpFailure: failure };
}
