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
