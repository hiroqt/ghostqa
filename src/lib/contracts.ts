import { z } from 'zod';

export const proposedActionSchema = z.strictObject({
  type: z.enum(['navigate', 'click', 'fill', 'press', 'scroll', 'wait']),
  target: z.string().min(1).max(200).optional(),
  value: z.string().max(500).optional(),
});

export const decisionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('action'),
    action: proposedActionSchema,
    expected: z.string().min(1).max(500),
    rationale: z.string().min(1).max(500),
  }),
  z.strictObject({ kind: z.literal('stop'), reason: z.string().min(1).max(500) }),
]);

export type ProposedAction = z.infer<typeof proposedActionSchema>;
export type Decision = z.infer<typeof decisionSchema>;

export type Observation = {
  screenshotPath: string;
  dom: string;
  consoleErrors: string[];
  httpFailures: { url: string; status: number }[];
};

export type ActionTrace = { action: ProposedAction; outcome: string };
export type DecisionContext = { observation: Observation; goal: string; priorTrace: ActionTrace[] };

/** A single improvement suggestion with location context and code evidence. */
export type Suggestion = {
  /** Human-readable description of the improvement. */
  text: string;
  reason?: string;
  /** CSS selector or element description indicating where in the page this applies. */
  selector: string;
  /** Short label for the UI location chip, e.g. "nav > a" or "<img>". */
  location: string;
  /** The relevant HTML/CSS snippet illustrating the issue. Empty string when unavailable. */
  codeSnippet: string;
  image?: string;
  bounds?: { x: number; y: number; width: number; height: number };
};
