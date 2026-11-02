# AI-generated design and code patterns

GhostQA reviews observable patterns. These signals are **not evidence of AI authorship**: humans can make the same choices, and AI-assisted work can avoid them. A single signal is not a defect by itself. The six-observation threshold and three-area requirement are product presentation rules, not a scientific classifier or quality score.

## What the research supports

- A [large study of verified AI-authored commits](https://arxiv.org/abs/2603.28592) found that code smells were the largest class of attributed issues. Its static-analysis categories support reviewing maintainability, but not identifying authorship from a rendered page.
- An [empirical study of generated-code bugs](https://arxiv.org/abs/2403.08937) describes missing corner cases, wrong input types, hallucinated objects/attributes, incomplete generation, and prompt-biased code. These require tests or source-level semantic analysis; GhostQA does not claim to detect them from visual styling.
- A [study of AI-generated build code](https://arxiv.org/abs/2601.16839) reports maintainability and security smells, including missing error handling and hardcoded paths or URLs. GhostQA's delivered-page scan does not inspect build scripts.
- Anthropic's [frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) documents recurring generated-page defaults: interchangeable card layouts, generic gradients, blur/glass effects, oversized rounding, and ornamental motion. These are design critique prompts, not proof of origin.
- The [Impeccable Slop catalog](https://impeccable.style/slop/) separates source-detectable cues from browser checks and design judgments. GhostQA implements a bounded subset of its source cues; it does not run or claim equivalence to Impeccable's full detector.

## What this MVP can inspect

The selected review run examines only bounded, same-origin HTML/CSS/JS responses already delivered to Chromium. It checks 35 source cues. HTML and CSS comments are excluded. Each displayed observation names its signal and a specific change. Raw source, script values, credentials, and page text are not copied into the story.

| Area | Source signals reviewed | Why they merit a closer look |
| --- | --- | --- |
| Components and cards | Repeated, nested, accented, heavily outlined, or icon-first cards; a badge above the main headline; empty image slots | Reused containers and decorative components can flatten priority or make an unfinished page look complete. The right structure depends on the content. |
| Text and type | Stock claims, forced “Not a … A …” contrast, dismissive “theater” copy, repeated em dashes, all-caps paragraphs, eyebrow labels, long display headlines, near-equal heading/body sizes, tight tracking, italic serif display type, and default Inter/Geist | Formulaic copy and weak type hierarchy make a product harder to understand. Any single choice may still be intentional. |
| Background and color | Generic, repeating, radial, grid, and text gradients; glass blur; cream backgrounds; neon shadows on dark surfaces | These treatments can compete with meaning when they are chosen as familiar defaults. A palette or texture can also be a legitimate brand decision. |
| Motion and layout | Pulsing status dots, auto-marquees, elastic easing, tiny numbered section labels, oversized radii | Motion and decoration should communicate state or structure. Static source cannot prove that a treatment is distracting in the rendered context. |
| Delivered code | Placeholder links, repeated `!important`, debug logs, and TODO/FIXME markers | These are review prompts for unfinished or brittle implementation, not AI-origin signals. |

The checks use concrete source shapes rather than counting vague style words in page prose. For example, the grid cue requires two gradients and a background size in one CSS rule; the nested-card cue requires card markup inside another card; the flat-type cue requires nearly equal explicit pixel sizes for `h2` and paragraphs. Common equivalents now include `rem` display sizes, either animation shorthand order, and paragraph CSS uppercase transforms. The stamp needs at least six distinct cues across three areas: backgrounds, components, typography, motion, copy, and delivered code. More complex relationships such as whether a card grid suits the content, whether a brand deliberately uses cream, or whether a glow is distracting require a human design review. One cue cannot establish provenance or quality by itself.

Each finding suggests a matching command from the [Impeccable GitHub skill](https://github.com/pbakaus/impeccable/tree/main/skill/reference), such as `layout`, `typeset`, `colorize`, `animate`, `clarify`, `polish`, or `harden`. A skill is guidance for the developer, not an automatic fix.

## Limits

This is a source-pattern review of one local or explicitly enabled public page, not a source repository audit. Cross-origin assets, source maps, dynamically imported resources after the initial page load, inaccessible CSS rules, and code omitted by the browser cannot be judged. The MVP's local network gate admits only fixture routes, including `/slop.css` and `/slop.js`. Live review accepts one public origin and blocks non-GET/HEAD requests; it does not crawl beyond that origin. The source checks do not measure computed style, visible geometry, contrast, or actual motion; CSS declarations may be unused. A screenshot alone cannot prove code quality or authorship. Fewer than six distinct signals or fewer than three areas yields `insufficient evidence` and no stamp.
