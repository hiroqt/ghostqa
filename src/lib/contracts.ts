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

export const COMMON_TEST_GOALS = [
  { label: 'Register / sign up', goal: 'Try registering with synthetic credentials and check form submission' },
  { label: 'Primary navigation & links', goal: 'Check primary navigation and visible links for broken destinations' },
  { label: 'Primary CTA flow', goal: 'Click the main call-to-action control and verify the resulting page state' },
  { label: 'Form inputs & validation', goal: 'Fill visible form inputs with synthetic values and verify submission' },
  { label: 'Page health & console', goal: 'Verify the page renders its main heading cleanly with no HTTP or console errors' },
] as const;
