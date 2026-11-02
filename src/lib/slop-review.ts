export type DeliveredSource = { kind: 'html' | 'css' | 'js' | 'other'; text: string };
export type SlopFinding = {
  id: string;
  category: 'Design' | 'Code';
  title: string;
  evidence: string;
  why: string;
  avoid: string;
  change: string;
  skill: { name: string; url: string };
};
export const SLOP_CUE_COUNT = 35;
export type SlopReview = { status: 'story' | 'insufficient-evidence'; findings: SlopFinding[]; matchedCount: number };

export function buildSlopAgentGuide(review: SlopReview): string {
  if (review.status !== 'story') return '# GhostQA design review handoff\n\nInsufficient evidence for a findings guide.\n';
  return [
    '# GhostQA design review handoff',
    '',
    `Matched ${review.matchedCount} of ${SLOP_CUE_COUNT} detectable source patterns. This is not an AI-authorship probability or a verified defect count.`,
    '',
    '## Instructions for the fixing agent',
    '',
    'Verify each observation in the rendered UI and delivered source before editing. Prioritize changes that help the product task. Preserve working behavior, accessibility, and intentional brand choices. Recheck the page after changes; do not treat a source cue alone as proof of a defect.',
    '',
    ...review.findings.flatMap((finding, index) => [
      `## ${index + 1}. ${finding.title}`,
      '',
      `**Observed:** ${finding.evidence}`,
      `**Why review it:** ${finding.why}`,
      `**Avoid:** ${finding.avoid}`,
      `**Change:** ${finding.change}`,
      `**Design guidance:** ${finding.skill.url}`,
      '',
    ]),
  ].join('\n');
}

type SkillCommand = 'animate' | 'clarify' | 'colorize' | 'distill' | 'harden' | 'layout' | 'polish' | 'quieter' | 'typeset';
const skill = (command: SkillCommand) => ({
  name: `Impeccable ${command}`,
  url: `https://github.com/pbakaus/impeccable/blob/main/skill/reference/${command}.md`,
});

// These are review prompts backed by source signals, not an AI-authorship classifier.
export function reviewSlopPatterns(sources: DeliveredSource[]): SlopReview {
  const html = sources.filter((source) => source.kind === 'html').map((source) => source.text).join('\n').replace(/<!--[\s\S]*?-->/g, '');
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1])
    .concat(sources.filter((source) => source.kind === 'css').map((source) => source.text)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const js = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])
    .concat(sources.filter((source) => source.kind === 'js').map((source) => source.text)).join('\n');
  const cssRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1], declarations: match[2] }));
  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => match[1].replace(/<[^>]+>/g, ' '));
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1].replace(/<[^>]+>/g, ' '));
  const findings: SlopFinding[] = [];
  const add = (condition: boolean, finding: SlopFinding) => { if (condition) findings.push(finding); };
  const decorativeGrid = cssRules.some(({ declarations }) => (declarations.match(/linear-gradient\(/gi) ?? []).length >= 2 && /background-size\s*:/i.test(declarations));
  const radialHalo = cssRules.some(({ declarations }) => /background(?:-image)?\s*:[^;]*radial-gradient\([^;]*transparent/i.test(declarations));

  add(!decorativeGrid && !radialHalo && /background(?:-image)?\s*:\s*(?:linear|radial)-gradient\(/i.test(css), {
    id: 'gradient', category: 'Design', title: 'Generic gradient backdrop',
    evidence: 'A CSS background uses a linear or radial gradient.',
    why: 'A default gradient can make unrelated products look interchangeable when it has no content role.',
    avoid: 'Using a gradient as the primary identity without a reason tied to the product.',
    change: 'Choose a palette and background treatment from the product’s content and audience.', skill: skill('colorize'),
  });
  add(/backdrop-filter\s*:[^;}{]*blur\(/i.test(css), {
    id: 'glass', category: 'Design', title: 'Blurred glass surface',
    evidence: 'CSS applies backdrop-filter blur.',
    why: 'A blurred surface can reduce legibility and often repeats a stock dashboard look.',
    avoid: 'Adding glass effects to ordinary content panels.',
    change: 'Use a solid surface and reserve transparency for a clear layering need.', skill: skill('quieter'),
  });
  add(/border-radius\s*:\s*(?:2[4-9]|[3-9]\d|\d{3,})px/i.test(css), {
    id: 'oversized-radius', category: 'Design', title: 'Oversized rounded corners',
    evidence: 'CSS sets a corner radius of at least 24px.',
    why: 'Large corners on routine panels can make the interface feel like a generic template.',
    avoid: 'Using the same large radius on every container.',
    change: 'Set a small radius scale based on component purpose and visual hierarchy.', skill: skill('polish'),
  });
  const cardCount = (html.match(/class\s*=\s*["'][^"']*\bcard\b[^"']*["']/gi) ?? []).length;
  add(cardCount >= 3, {
    id: 'repeated-cards', category: 'Design', title: 'Repeated card grid',
    evidence: `${cardCount} elements use a card class.`,
    why: 'Repeating identical containers can flatten hierarchy when the content has different importance.',
    avoid: 'Wrapping every item in an equivalent card by default.',
    change: 'Group related items and vary emphasis according to the user’s task.', skill: skill('layout'),
  });
  const placeholderCount = (html.match(/<a\b[^>]*\bhref\s*=\s*["']#["']/gi) ?? []).length;
  add(placeholderCount > 0, {
    id: 'placeholder-link', category: 'Code', title: 'Placeholder navigation',
    evidence: `${placeholderCount} anchor${placeholderCount === 1 ? '' : 's'} use href="#".`,
    why: 'A link that only jumps to the top looks functional but does not complete its promised task.',
    avoid: 'Shipping visible links before their destination exists.',
    change: 'Point the link to a real destination or remove it until the action is ready.', skill: skill('harden'),
  });
  const importantCount = (css.match(/!important\b/gi) ?? []).length;
  add(importantCount >= 3, {
    id: 'important-overrides', category: 'Code', title: 'Repeated CSS overrides',
    evidence: `${importantCount} CSS declarations use !important.`,
    why: 'Repeated overrides make later changes unpredictable and can hide specificity conflicts.',
    avoid: 'Adding another !important to settle each styling conflict.',
    change: 'Simplify selector ownership and remove conflicting declarations.', skill: skill('polish'),
  });
  add(/\bconsole\.(?:log|debug)\s*\(/.test(js), {
    id: 'debug-log', category: 'Code', title: 'Debug logging in delivered script',
    evidence: 'Delivered JavaScript contains console.log or console.debug.',
    why: 'Debug output is an unfinished delivery signal and can expose runtime details.',
    avoid: 'Leaving ad hoc console output in shipped UI code.',
    change: 'Remove the debug statement or replace it with intentional, privacy-aware diagnostics.', skill: skill('harden'),
  });
  add(/\b(?:TODO|FIXME)\b/.test(js), {
    id: 'unfinished-marker', category: 'Code', title: 'Unfinished code marker',
    evidence: 'Delivered JavaScript contains TODO or FIXME.',
    why: 'A marker in shipped code may indicate an incomplete path that deserves explicit review.',
    avoid: 'Treating a comment as proof that unfinished behavior is acceptable.',
    change: 'Resolve the marked behavior or track it outside the delivered bundle.', skill: skill('harden'),
  });

  add(/background(?:-image)?\s*:\s*repeating-(?:linear|radial)-gradient\(/i.test(css), {
    id: 'repeating-stripes', category: 'Design', title: 'Repeating-gradient stripes',
    evidence: 'A CSS background uses a repeating gradient.',
    why: 'Repeated stripes can fill empty space with noise instead of aiding the task.',
    avoid: 'Using repeating texture as default decoration.',
    change: 'Use a plain surface or a texture tied to the product.', skill: skill('distill'),
  });
  add(cssRules.some(({ declarations }) => /(?:linear|radial)-gradient\(/i.test(declarations) && /(?:-webkit-)?background-clip\s*:\s*text/i.test(declarations)), {
    id: 'gradient-text', category: 'Design', title: 'Gradient text',
    evidence: 'One CSS rule combines a gradient with background-clip: text.',
    why: 'Color changes across a headline can compete with its message.',
    avoid: 'Applying a gradient to headline text only for decoration.',
    change: 'Use a solid text color and let size or weight establish emphasis.', skill: skill('colorize'),
  });
  add(cssRules.some(({ selector, declarations }) => /\b(?:card|panel|feature)\b/i.test(selector) && /border-left\s*:\s*(?:[4-9]|\d{2,})px\s+solid/i.test(declarations) && /border-radius\s*:/i.test(declarations)), {
    id: 'side-tab', category: 'Design', title: 'Side-tab accent border',
    evidence: 'A rounded card or panel has a thick solid left border.',
    why: 'A stripe can make an ordinary card read like an alert without carrying status.',
    avoid: 'Adding a colored side stripe to every card.',
    change: 'Reserve strong border accents for meaningful states or remove the stripe.', skill: skill('polish'),
  });
  add(cssRules.some(({ declarations }) => /border\s*:\s*1px\s+solid/i.test(declarations) && /box-shadow\s*:[^;]*\b(?:[2-9]\d|\d{3,})px\b/i.test(declarations)), {
    id: 'hairline-shadow', category: 'Design', title: 'Hairline border with wide shadow',
    evidence: 'One CSS rule combines a 1px border with a broad box shadow.',
    why: 'Two competing edge treatments can make the same surface feel overworked.',
    avoid: 'Stacking a fine outline and large soft shadow by default.',
    change: 'Use the border or shadow that best communicates the surface boundary.', skill: skill('polish'),
  });
  add(/font-family\s*:[^;}]*\b(?:Inter|Geist)\b/i.test(css), {
    id: 'overused-font', category: 'Design', title: 'Common default font',
    evidence: 'Delivered CSS names Inter or Geist in a font-family declaration.',
    why: 'A familiar default can make unrelated products feel typographically interchangeable.',
    avoid: 'Choosing a font only because it is the common UI default.',
    change: 'Check the brand and reading needs before keeping or changing the typeface.', skill: skill('typeset'),
  });
  add(/letter-spacing\s*:\s*-(?:0\.0[6-9]|0\.[1-9]\d*)em/i.test(css), {
    id: 'crushed-spacing', category: 'Design', title: 'Crushed letter spacing',
    evidence: 'CSS sets letter spacing tighter than -0.05em.',
    why: 'Tight tracking can make letters harder to distinguish.',
    avoid: 'Compressing display text until the letter shapes crowd together.',
    change: 'Loosen tracking and check readability at small widths.', skill: skill('typeset'),
  });
  add(cssRules.some(({ selector, declarations }) => /status|dot|indicator/i.test(selector) && /animation\s*:[^;]*\bpulse\b/i.test(declarations) && /animation\s*:[^;]*\binfinite\b/i.test(declarations)), {
    id: 'pulsing-status', category: 'Design', title: 'Pulsing status dot',
    evidence: 'A status or dot selector has an infinite pulse animation.',
    why: 'Continuous motion asks for attention even when the state is unchanged.',
    avoid: 'Pulsing a static status indicator.',
    change: 'Keep steady states still and animate only meaningful changes.', skill: skill('animate'),
  });
  add(/<marquee\b/i.test(html) || cssRules.some(({ selector, declarations }) => /marquee/i.test(selector) && /animation\s*:[^;]*\binfinite\b/i.test(declarations)), {
    id: 'auto-marquee', category: 'Design', title: 'Auto-scrolling marquee',
    evidence: 'Markup or CSS defines a continuously moving marquee.',
    why: 'Moving content makes people read at the page’s pace.',
    avoid: 'Auto-scrolling text or logos without a task need.',
    change: 'Keep the content still or give people a clear pause control.', skill: skill('animate'),
  });
  add(cssRules.some(({ selector, declarations }) => /\bh1\b/i.test(selector) && /font-family\s*:[^;]*\bserif\b/i.test(declarations) && /font-style\s*:\s*italic/i.test(declarations)), {
    id: 'italic-serif-hero', category: 'Design', title: 'Italic serif hero',
    evidence: 'An h1 rule combines a serif family and italic style.',
    why: 'The treatment can borrow a stock editorial mood unrelated to the product.',
    avoid: 'Using italic serif display type as a shortcut to personality.',
    change: 'Choose a headline style that fits this product’s content and voice.', skill: skill('typeset'),
  });
  add(/<(?:span|small|p)\b[^>]*class=["'][^"']*\b(?:eyebrow|overline|kicker)\b[^"']*["'][^>]*>[\s\S]*?<\/(?:span|small|p)>\s*<h[1-3]\b/i.test(html), {
    id: 'label-above-heading', category: 'Design', title: 'Label above a heading',
    evidence: 'An eyebrow, overline, or kicker element sits directly before a heading.',
    why: 'The extra line may repeat the heading instead of helping people scan.',
    avoid: 'Adding a label above every section heading by default.',
    change: 'Keep only labels that add context; move useful words into the heading.', skill: skill('typeset'),
  });
  add([...headings, ...paragraphs].some((text) => /\b(?:supercharge|world.class|next.generation|unlock (?:your|the) potential)\b/i.test(text)), {
    id: 'generic-claim', category: 'Design', title: 'Generic marketing claim',
    evidence: 'A visible heading or paragraph uses a stock marketing phrase.',
    why: 'Broad claims say little about what the product lets people do.',
    avoid: 'Using interchangeable promises in the primary message.',
    change: 'State the concrete task or outcome in product-specific words.', skill: skill('clarify'),
  });
  add(paragraphs.reduce((count, paragraph) => count + (paragraph.match(/—/g) ?? []).length, 0) >= 3, {
    id: 'em-dash-overuse', category: 'Design', title: 'Repeated em dashes in copy',
    evidence: 'Visible paragraphs contain at least three em dashes.',
    why: 'Frequent dashes can make the copy feel formulaic and harder to follow.',
    avoid: 'Using a dash for every pause or contrast.',
    change: 'Use full stops or clearer sentence structure where the thought changes.', skill: skill('clarify'),
  });
  add(/class=["'][^"']*\bcard\b[^"']*["'][^>]*>[\s\S]{0,500}?class=["'][^"']*\bicon\b[^"']*["'][^>]*>[\s\S]{0,200}?<\/[^>]+>\s*<h[2-4]\b/i.test(html), {
    id: 'icon-tile', category: 'Design', title: 'Icon tile above a heading',
    evidence: 'A card places an icon element directly above a heading.',
    why: 'Repeated icon-first cards can make decoration more prominent than the feature.',
    avoid: 'Putting every feature icon in the same stacked tile.',
    change: 'Place meaningful icons beside text or remove the container.', skill: skill('typeset'),
  });

  add(decorativeGrid, {
    id: 'decorative-grid', category: 'Design', title: 'Decorative grid background',
    evidence: 'One CSS rule combines two linear gradients with a repeating background size.',
    why: 'A measurement-like grid adds visual lines without helping people use ordinary page content.',
    avoid: 'Using canvas-style grid lines as a default backdrop.',
    change: 'Use a plain surface unless the task needs a grid.', skill: skill('layout'),
  });
  add(/<(?:div|section|article)\b[^>]*class=["'][^"']*\bcard\b[^"']*["'][^>]*>(?:(?!<\/(?:div|section|article)>)[\s\S]){0,1000}<(?:div|section|article)\b[^>]*class=["'][^"']*\bcard\b/i.test(html), {
    id: 'nested-cards', category: 'Design', title: 'Nested cards',
    evidence: 'A card element contains another card element.',
    why: 'Nested surfaces add depth and padding without making the content easier to understand.',
    avoid: 'Wrapping a card in another card for routine grouping.',
    change: 'Flatten the group with spacing, headings, or dividers.', skill: skill('layout'),
  });
  add(/<(?:span|small)\b[^>]*class=["'][^"']*\bbadge\b[^"']*["'][^>]*>[\s\S]*?<\/(?:span|small)>\s*<h1\b/i.test(html), {
    id: 'hero-badge', category: 'Design', title: 'Badge above the main headline',
    evidence: 'A badge element appears directly before the h1.',
    why: 'A pill can compete with the main message while adding little context.',
    avoid: 'Prepending a decorative badge to every hero.',
    change: 'Move useful information into the headline or supporting text.', skill: skill('typeset'),
  });
  add(headings.some((heading) => heading.length >= 45) && cssRules.some(({ selector, declarations }) => {
    const size = declarations.match(/font-size\s*:\s*([\d.]+)(px|rem)\b/i);
    return /(?:^|,)\s*h1\b/i.test(selector) && Boolean(size && Number(size[1]) >= (size[2].toLowerCase() === 'rem' ? 3.75 : 60));
  }), {
    id: 'oversized-hero', category: 'Design', title: 'Long display-size hero headline',
    evidence: 'A long h1 is paired with a CSS font size of at least 60px or 3.75rem.',
    why: 'The headline can consume the opening screen before the page explains the offer.',
    avoid: 'Setting a long product claim at display size by default.',
    change: 'Shorten the claim or reduce its size and check the first viewport.', skill: skill('typeset'),
  });
  const headingSize = cssRules.find(({ selector }) => /(?:^|,)\s*h2\b/i.test(selector))?.declarations.match(/font-size\s*:\s*(\d+)px/i);
  const bodySize = cssRules.find(({ selector }) => /(?:^|,)\s*p\b/i.test(selector))?.declarations.match(/font-size\s*:\s*(\d+)px/i);
  add(Boolean(headingSize && bodySize && Math.abs(Number(headingSize[1]) - Number(bodySize[1])) <= 2), {
    id: 'flat-type', category: 'Design', title: 'Flat type hierarchy',
    evidence: 'h2 and paragraph font sizes differ by at most 2px.',
    why: 'Similar heading and body sizes make sections harder to scan.',
    avoid: 'Giving headings and body copy nearly identical emphasis.',
    change: 'Separate the roles through size, weight, and spacing.', skill: skill('typeset'),
  });
  add(paragraphs.some((paragraph) => {
    const letters = paragraph.match(/[a-z]/gi) ?? [];
    return letters.length >= 40 && letters.filter((letter) => letter === letter.toUpperCase()).length / letters.length > .9;
  }) || (paragraphs.some((paragraph) => (paragraph.match(/[a-z]/gi) ?? []).length >= 40) && cssRules.some(({ selector, declarations }) => /(?:^|,)\s*p\b/i.test(selector) && /text-transform\s*:\s*uppercase\b/i.test(declarations))), {
    id: 'all-caps-body', category: 'Design', title: 'All-caps body copy',
    evidence: 'A long paragraph is uppercase in markup or through a paragraph CSS rule.',
    why: 'Long uppercase passages are slower to read than sentence-case body text.',
    avoid: 'Using capitals for ordinary explanatory paragraphs.',
    change: 'Use sentence case and reserve capitals for short labels.', skill: skill('typeset'),
  });
  add(radialHalo, {
    id: 'radial-halo', category: 'Design', title: 'Radial background halo',
    evidence: 'A CSS background uses a radial gradient fading to transparent.',
    why: 'A decorative spotlight can pull attention from the content.',
    avoid: 'Adding a glow behind a section without a content role.',
    change: 'Use spacing, contrast, and a clear heading to establish emphasis.', skill: skill('colorize'),
  });
  add(/background(?:-color)?\s*:\s*#(?:f5f1e8|f6f1e7|f7f3e9|f5f0e6|faf6ed)\b/i.test(css), {
    id: 'cream-palette', category: 'Design', title: 'Default cream backdrop',
    evidence: 'CSS sets a common warm cream background color.',
    why: 'A familiar beige surface can substitute for a product-specific palette.',
    avoid: 'Choosing cream only because it feels editorial.',
    change: 'Keep it when the brand calls for it; otherwise choose colors from the product context.', skill: skill('colorize'),
  });
  add(cssRules.some(({ declarations }) => /background(?:-color)?\s*:\s*#(?:111|000|0[0-9a-f]{5})\b/i.test(declarations) && /box-shadow\s*:[^;]*#(?:00ffff|0ff|00e5ff|7c3aed)\b/i.test(declarations)), {
    id: 'dark-neon', category: 'Design', title: 'Neon glow on dark surface',
    evidence: 'One CSS rule combines a dark background with a bright cyan or violet shadow.',
    why: 'Glowing edges can make a routine interface visually noisy.',
    avoid: 'Using neon on every dark panel as a default accent.',
    change: 'Reduce the glow and reserve strong color for useful emphasis.', skill: skill('colorize'),
  });
  add(/<(?:span|small)\b[^>]*class=["'][^"']*\bsection-number\b[^"']*["'][^>]*>\s*0?\d{1,2}\s*<\/(?:span|small)>\s*<h[2-3]\b/i.test(html), {
    id: 'numbered-label', category: 'Design', title: 'Tiny numbered section label',
    evidence: 'A section-number element with a two-digit number sits before a heading.',
    why: 'Numbers add clutter when the sections are not steps in a sequence.',
    avoid: 'Numbering unrelated content blocks as decoration.',
    change: 'Keep numbers only when order helps the reader.', skill: skill('layout'),
  });
  add(/cubic-bezier\(\s*[\d.]+\s*,\s*1\.[1-9]\d*\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)/i.test(css), {
    id: 'elastic-motion', category: 'Design', title: 'Elastic overshoot motion',
    evidence: 'A CSS cubic-bezier easing overshoots above 1.',
    why: 'Bouncy entry motion can make routine interactions feel fussy.',
    avoid: 'Using overshoot easing on ordinary controls and dialogs.',
    change: 'Use a short easing that settles cleanly, with reduced-motion support.', skill: skill('animate'),
  });
  add(paragraphs.some((paragraph) => /\bnot (?:a|an|the) [^.]{2,50}\.\s*(?:a|an|the) [^.]{2,50}\./i.test(paragraph)), {
    id: 'forced-contrast', category: 'Design', title: 'Forced contrast slogan',
    evidence: 'A paragraph uses a “Not a … . A … .” slogan structure.',
    why: 'The contrast can sound decisive without explaining a useful difference.',
    avoid: 'Framing every feature as a category-defying slogan.',
    change: 'State the actual capability and why it matters.', skill: skill('clarify'),
  });
  add(paragraphs.some((paragraph) => /\b(?:growth|security|innovation|productivity) theater\b/i.test(paragraph)), {
    id: 'theater-copy', category: 'Design', title: 'Dismissive “theater” copy',
    evidence: 'A paragraph uses “theater” as a dismissal of another practice.',
    why: 'The label can replace a clear explanation of what is ineffective.',
    avoid: 'Dismissing alternatives with a slogan alone.',
    change: 'Name the concrete problem and show how this product addresses it.', skill: skill('clarify'),
  });
  add(/<img\b[^>]*\bsrc\s*=\s*["'](?:\s*|#|placeholder[^"']*)["']/i.test(html), {
    id: 'placeholder-image', category: 'Design', title: 'Placeholder or empty image',
    evidence: 'An img element has an empty or placeholder source.',
    why: 'An unfinished image slot makes the page feel incomplete.',
    avoid: 'Shipping an image component before its asset exists.',
    change: 'Use the intended image or remove the element.', skill: skill('harden'),
  });

  const areas = {
    backgrounds: ['gradient', 'glass', 'repeating-stripes', 'gradient-text', 'decorative-grid', 'radial-halo', 'cream-palette', 'dark-neon'],
    components: ['oversized-radius', 'repeated-cards', 'side-tab', 'hairline-shadow', 'icon-tile', 'nested-cards', 'hero-badge', 'placeholder-image'],
    typography: ['overused-font', 'crushed-spacing', 'italic-serif-hero', 'label-above-heading', 'oversized-hero', 'flat-type', 'all-caps-body', 'numbered-label'],
    motion: ['pulsing-status', 'auto-marquee', 'elastic-motion'],
    copy: ['generic-claim', 'em-dash-overuse', 'forced-contrast', 'theater-copy'],
    code: ['placeholder-link', 'important-overrides', 'debug-log', 'unfinished-marker'],
  };
  const areaCount = Object.values(areas).filter((ids) => findings.some((finding) => ids.includes(finding.id))).length;
  return findings.length >= 6 && areaCount >= 3
    ? { status: 'story', findings, matchedCount: findings.length }
    : { status: 'insufficient-evidence', findings: [], matchedCount: findings.length };
}
