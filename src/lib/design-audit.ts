import { matchSlopPatterns, reviewSlopPatterns, skill, SLOP_CUE_COUNT, type DeliveredSource, type SlopFinding, type SlopReview } from './slop-review';

// Rendered-design audit for GQ-011. The primary evidence is what Chromium actually
// rendered (computed styles + layout boxes from a CDP DOM snapshot, which does not
// run page JavaScript). The source guideline cues in slop-review.ts are attached as
// supporting detail and can raise confidence, but can never produce the stamp alone.

export const RENDERED_STYLE_PROPERTIES = [
  'background-color', 'background-image', 'backdrop-filter', 'border-top-left-radius', 'box-shadow',
  'font-family', 'font-size', 'text-align', 'background-clip', '-webkit-background-clip', 'visibility', 'opacity',
] as const;
type StyleProperty = (typeof RENDERED_STYLE_PROPERTIES)[number];
type Style = Record<StyleProperty, string>;
type Box = { x: number; y: number; width: number; height: number };
export type RenderedElement = Box & { tag: string; style: Style };
/** A visible text run. Only its length is kept; page text never leaves the parser. */
export type RenderedText = Box & { length: number; style: Style };
export type RenderedPage = { viewport: { width: number; height: number }; elements: RenderedElement[]; texts: RenderedText[] };

type RawSnapshot = {
  strings: string[];
  documents: Array<{
    nodes: { nodeType?: number[]; nodeName?: number[] };
    layout: { nodeIndex: number[]; bounds: number[][]; styles: number[][]; text?: number[] };
  }>;
};

const MAX_NODES = 5_000;

export function parseDomSnapshot(raw: RawSnapshot, viewport: { width: number; height: number }): RenderedPage {
  const page: RenderedPage = { viewport, elements: [], texts: [] };
  const document = raw.documents[0];
  if (!document) return page;
  const value = (index: number | undefined) => (index !== undefined && index >= 0 ? raw.strings[index] ?? '' : '');
  const { nodes, layout } = document;
  for (let i = 0; i < Math.min(layout.nodeIndex.length, MAX_NODES); i++) {
    const node = layout.nodeIndex[i];
    const type = nodes.nodeType?.[node];
    const [x = 0, y = 0, width = 0, height = 0] = layout.bounds[i] ?? [];
    if ((type !== 1 && type !== 3) || width <= 0 || height <= 0) continue;
    const style = Object.fromEntries(RENDERED_STYLE_PROPERTIES.map((property, index) => [property, value(layout.styles[i]?.[index])])) as Style;
    if (style.visibility !== 'visible' || Number(style.opacity) === 0) continue;
    if (type === 1) page.elements.push({ tag: value(nodes.nodeName?.[node]).toUpperCase(), x, y, width, height, style });
    else {
      const length = value(layout.text?.[i]).trim().length;
      if (length > 0) page.texts.push({ x, y, width, height, length, style });
    }
  }
  return page;
}

export type DesignAspect = 'color' | 'surface' | 'layout' | 'type' | 'composition';
export type DesignFinding = {
  id: string; aspect: DesignAspect; title: string; measured: string; why: string; change: string;
  weight: number; strength: 'strong' | 'weak'; skill: { name: string; url: string }; supportedBy: string[];
};
export type DesignVerdict = 'ai-slop-design' | 'ai-slop-pattern' | 'mixed' | 'distinct-design' | 'insufficient-evidence';
export const VERDICT_LABELS: Record<DesignVerdict, string> = {
  'ai-slop-design': 'AI slop by design',
  'ai-slop-pattern': 'AI slop by pattern only',
  mixed: 'Mixed signals',
  'distinct-design': 'Distinct design',
  'insufficient-evidence': 'Insufficient evidence',
};
export type DesignReview = {
  verdict: DesignVerdict;
  designScore: number;
  confidence: 'high' | 'medium' | 'low';
  designFindings: DesignFinding[];
  patternReview: SlopReview;
  supportingCues: SlopFinding[];
};

// Which guideline cue IDs support each rendered observation.
const SUPPORT: Record<string, string[]> = {
  'violet-gradient-canvas': ['gradient', 'radial-halo', 'repeating-stripes', 'decorative-grid'],
  'gradient-canvas': ['gradient', 'radial-halo', 'repeating-stripes', 'decorative-grid', 'cream-palette'],
  'glass-surfaces': ['glass'],
  'uniform-cards': ['repeated-cards', 'nested-cards', 'icon-tile', 'side-tab'],
  'one-radius': ['oversized-radius'],
  'soft-shadow': ['hairline-shadow'],
  'flat-type-scale': ['flat-type', 'oversized-hero', 'all-caps-body'],
  'single-default-font': ['overused-font'],
  'gradient-text': ['gradient-text'],
  'centered-stack': ['hero-badge', 'label-above-heading', 'generic-claim'],
};
const DEFAULT_FONTS = new Set(['inter', 'geist', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'roboto', 'arial', 'helvetica', 'helvetica neue', 'segoe ui', 'sans-serif', 'ui-sans-serif']);

const px = (value: string) => Number.parseFloat(value) || 0;
const area = (box: Box) => box.width * box.height;
const percent = (part: number, whole: number) => Math.min(100, Math.round((part / whole) * 100));
const colors = (value: string) => [...value.matchAll(/rgba?\(([^)]+)\)/g)].map((match) => match[1].split(/[\s,/]+/).filter(Boolean).map(Number));
const alpha = (value: string) => colors(value)[0]?.[3] ?? (colors(value).length ? 1 : 0);
const textClipped = (style: Style) => style['background-clip'] === 'text' || style['-webkit-background-clip'] === 'text';
const firstFamily = (value: string) => (value.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();
const safeName = (value: string) => value.replace(/[^\w\s-]/g, '').slice(0, 40) || 'an unnamed family';
function hsl([r, g, b]: number[]): { hue: number; saturation: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn); const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === rn ? ((gn - bn) / delta) % 6 : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
  return { hue: Math.round((hue * 60 + 360) % 360), saturation };
}
function mode<T>(values: T[]): { value: T; count: number } | undefined {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)[0];
}

type Signal = Omit<DesignFinding, 'supportedBy'>;

export function auditRenderedDesign(page: RenderedPage): Omit<DesignFinding, 'supportedBy'>[] {
  const { viewport, elements, texts } = page;
  const viewportArea = viewport.width * viewport.height;
  const signals: Signal[] = [];
  const canvasArea = (element: RenderedElement) => (element.tag === 'HTML' || element.tag === 'BODY' ? viewportArea : area(element));

  // Color: a large gradient canvas, with the violet-blue default called out.
  const canvas = elements.filter((element) => /gradient\(/.test(element.style['background-image']) && !textClipped(element.style) && canvasArea(element) >= viewportArea * 0.4)
    .sort((a, b) => canvasArea(b) - canvasArea(a))[0];
  if (canvas) {
    const tones = colors(canvas.style['background-image']).map(hsl).filter((tone) => tone.saturation >= 0.35);
    const violet = tones.length > 0 && tones.filter((tone) => tone.hue >= 220 && tone.hue <= 300).length * 2 >= tones.length;
    const measured = `A ${tones.length ? `${tones.map((tone) => `${tone.hue}°`).join(' → ')} ` : ''}gradient paints ${percent(canvasArea(canvas), viewportArea)}% of the first viewport.`;
    signals.push(violet
      ? { id: 'violet-gradient-canvas', aspect: 'color', title: 'Violet-blue gradient canvas', measured, weight: 25, strength: 'strong',
        why: 'The rendered page is dominated by the indigo-to-violet gradient that generated landing pages default to, so it reads as a template before any content does.',
        change: 'Derive the page color from the product and its audience; use a flat or purposeful surface and keep strong color for actions and status.', skill: skill('colorize') }
      : { id: 'gradient-canvas', aspect: 'color', title: 'Gradient canvas behind the content', measured, weight: 12, strength: 'weak',
        why: 'A full-page gradient carries the visual identity without saying anything about the product.',
        change: 'Check whether the gradient has a content role; otherwise use a calmer surface.', skill: skill('colorize') });
  }

  // Surface: frosted glass panels that are actually painted.
  const glass = elements.filter((element) => /blur\(/.test(element.style['backdrop-filter']) && area(element) >= viewportArea * 0.01);
  if (glass.length) signals.push({
    id: 'glass-surfaces', aspect: 'surface', title: 'Frosted glass panels', weight: 15, strength: 'strong',
    measured: `${glass.length} visible surface${glass.length === 1 ? '' : 's'} render backdrop-filter ${glass[0].style['backdrop-filter']}, covering ${percent(glass.reduce((sum, element) => sum + area(element), 0), viewportArea)}% of the viewport.`,
    why: 'Blurred translucent panels over a gradient are a stock generated-dashboard look and lower text contrast on the rendered page.',
    change: 'Use solid surfaces with clear contrast; keep translucency only where a real layer sits above content.', skill: skill('quieter'),
  });

  // Layout: identical surfaces repeated as the page structure.
  const surfaces = elements.filter((element) => element.tag !== 'HTML' && element.tag !== 'BODY' && area(element) >= 2_000
    && (alpha(element.style['background-color']) > 0 || element.style['box-shadow'] !== 'none' || element.style['backdrop-filter'] !== 'none'));
  const look = (element: RenderedElement) => `${element.style['border-top-left-radius']}|${element.style['box-shadow']}|${element.style['background-color']}`;
  const twins = surfaces.map((surface) => surfaces.filter((other) => Math.abs(other.width - surface.width) <= 4 && Math.abs(other.height - surface.height) <= 4 && look(other) === look(surface)))
    .sort((a, b) => b.length - a.length)[0] ?? [];
  if (twins.length >= 3) signals.push({
    id: 'uniform-cards', aspect: 'layout', title: 'Interchangeable card set', weight: 20, strength: 'strong',
    measured: `${twins.length} visible surfaces render at ${Math.round(twins[0].width)}×${Math.round(twins[0].height)}px with the same ${twins[0].style['border-top-left-radius']} radius, shadow, and fill.`,
    why: 'When every item gets the same box, the rendered page has no hierarchy; content of different importance looks equally (un)important.',
    change: 'Size and group items by importance; promote the primary item and let secondary ones drop the container.', skill: skill('layout'),
  });

  if (surfaces.length >= 3) {
    const radius = mode(surfaces.map((surface) => surface.style['border-top-left-radius']));
    if (radius && px(radius.value) >= 16 && radius.count / surfaces.length >= 0.8) signals.push({
      id: 'one-radius', aspect: 'surface', title: 'One large radius on every surface', weight: 10, strength: 'weak',
      measured: `${radius.count} of ${surfaces.length} visible surfaces render the same ${radius.value} corner radius.`,
      why: 'A single soft radius applied everywhere flattens the difference between controls, cards, and containers.',
      change: 'Define a small radius scale tied to component role.', skill: skill('polish'),
    });
    const shadow = mode(surfaces.map((surface) => surface.style['box-shadow']));
    const blur = shadow ? px(shadow.value.replace(/rgba?\([^)]*\)/g, '').trim().split(/\s+/)[2] ?? '0') : 0;
    if (shadow && shadow.value !== 'none' && blur >= 16 && shadow.count / surfaces.length >= 0.8) signals.push({
      id: 'soft-shadow', aspect: 'surface', title: 'One soft drop shadow on every surface', weight: 10, strength: 'weak',
      measured: `${shadow.count} of ${surfaces.length} visible surfaces render the same ${Math.round(blur)}px-blur shadow.`,
      why: 'A uniform floating shadow makes everything sit at the same elevation, so depth stops meaning anything.',
      change: 'Reserve elevation for overlays and interactive emphasis; let ordinary groups sit flat.', skill: skill('polish'),
    });
  }

  // Type: scale and voice as rendered.
  if (texts.length >= 3) {
    const sizes = [...new Set(texts.map((text) => Math.round(px(text.style['font-size']))))].sort((a, b) => b - a);
    const weighted = new Map<number, number>();
    for (const text of texts) weighted.set(Math.round(px(text.style['font-size'])), (weighted.get(Math.round(px(text.style['font-size']))) ?? 0) + text.length);
    // Body = the size carrying the most characters; ties go to the smaller size.
    const body = [...weighted].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] || 16;
    const ratio = sizes[0] / body;
    if (sizes.length <= 2 || ratio < 1.5) signals.push({
      id: 'flat-type-scale', aspect: 'type', title: 'Flat rendered type scale', weight: 10, strength: 'weak',
      measured: `${texts.length} visible text runs render in ${sizes.length} size${sizes.length === 1 ? '' : 's'} (${sizes.join(', ')}px); the largest is ${ratio.toFixed(1)}× the body size.`,
      why: 'Without a deliberate scale, headings, labels, and body read at similar weight and the page is hard to scan.',
      change: 'Set a type scale with distinct roles for display, heading, body, and label text.', skill: skill('typeset'),
    });
    const families = [...new Set(texts.map((text) => firstFamily(text.style['font-family'])))];
    if (families.length === 1 && DEFAULT_FONTS.has(families[0])) signals.push({
      id: 'single-default-font', aspect: 'type', title: 'One default font for everything', weight: 10, strength: 'weak',
      measured: `All ${texts.length} visible text runs render in one family led by ${safeName(families[0])}.`,
      why: 'A single stock UI face for every role gives the page no typographic voice of its own.',
      change: 'Pick type for the brand and reading task; pair a display face with the body face if the content warrants it.', skill: skill('typeset'),
    });
  }
  const gradientText = elements.filter((element) => textClipped(element.style) && /gradient\(/.test(element.style['background-image']));
  if (gradientText.length) signals.push({
    id: 'gradient-text', aspect: 'type', title: 'Gradient-filled headline text', weight: 15, strength: 'strong',
    measured: `${gradientText.length} visible element${gradientText.length === 1 ? '' : 's'} render a gradient clipped to text.`,
    why: 'Rainbow-filled headings are a signature of generated hero sections and pull the eye to color instead of the message.',
    change: 'Use a solid text color and let size, weight, and spacing carry emphasis.', skill: skill('colorize'),
  });

  // Composition: everything stacked on the center axis.
  if (texts.length >= 4) {
    const centered = texts.filter((text) => text.style['text-align'] === 'center' && Math.abs(text.x + text.width / 2 - viewport.width / 2) <= viewport.width * 0.03);
    if (centered.length / texts.length >= 0.8) signals.push({
      id: 'centered-stack', aspect: 'composition', title: 'Everything centered in one column', weight: 10, strength: 'weak',
      measured: `${centered.length} of ${texts.length} visible text runs are center-aligned on the page axis.`,
      why: 'A symmetric centered stack is the default generated hero layout and gives the eye no entry point or reading path.',
      change: 'Use an asymmetric grid or left-aligned reading column so the layout reflects content priority.', skill: skill('layout'),
    });
  }
  return signals.sort((a, b) => b.weight - a.weight);
}

// Accepts one capture or several captures of the same page. With several, a
// design signal counts only when every capture measured it, so a verdict never
// rests on content that shifted between captures (lazy loads, rotating ads).
export function reviewDesign(input: RenderedPage | null | Array<RenderedPage | null>, sources: DeliveredSource[]): DesignReview {
  const patternReview = reviewSlopPatterns(sources);
  const supportingCues = matchSlopPatterns(sources);
  const patternStory = patternReview.status === 'story';
  const pages = Array.isArray(input) ? input : [input];
  if (pages.length === 0 || pages.some((page) => !page || page.texts.length < 3)) {
    return { verdict: 'insufficient-evidence', designScore: 0, confidence: 'low', designFindings: [], patternReview, supportingCues };
  }
  const [first, ...rest] = (pages as RenderedPage[]).map(auditRenderedDesign);
  const stable = first.filter((signal) => rest.every((other) => other.some((candidate) => candidate.id === signal.id)));
  const unstable = stable.length < first.length || rest.some((other) => other.length > stable.length);
  const designFindings = stable.map((signal) => ({
    ...signal,
    supportedBy: supportingCues.filter((cue) => SUPPORT[signal.id]?.includes(cue.id)).map((cue) => cue.title),
  }));
  const designScore = Math.min(100, designFindings.reduce((sum, finding) => sum + finding.weight, 0));
  const aspects = new Set(designFindings.map((finding) => finding.aspect)).size;
  const strong = designFindings.some((finding) => finding.strength === 'strong');
  const verdict: DesignVerdict = designScore >= 50 && aspects >= 2 && strong ? 'ai-slop-design'
    : designScore >= 25 ? 'mixed'
      : patternStory ? 'ai-slop-pattern' : 'distinct-design';
  const confidence = verdict === 'ai-slop-design' ? (patternStory ? 'high' : 'medium')
    : verdict === 'mixed' ? (patternStory ? 'medium' : 'low')
      : verdict === 'ai-slop-pattern' ? 'medium'
        : supportingCues.length ? 'medium' : 'high';
  return { verdict, designScore, confidence: unstable ? 'low' : confidence, designFindings, patternReview, supportingCues };
}

export function buildDesignAgentGuide(review: DesignReview): string {
  return [
    '# GhostQA design review handoff',
    '',
    `**Verdict:** ${VERDICT_LABELS[review.verdict]} · **Design score:** ${review.designScore}/100 · **Confidence:** ${review.confidence}`,
    '',
    `Rendered design is the primary evidence. Guideline cues matched in delivered source: ${review.supportingCues.length} of ${SLOP_CUE_COUNT} (supporting detail). Neither is an AI-authorship probability or a verified defect count.`,
    '',
    '## Instructions for the fixing agent',
    '',
    'Start from the rendered page: reproduce each measured observation in the browser before editing. Use the guideline cues only to locate the responsible source. Prioritize changes that help the product task. Preserve working behavior, accessibility, and intentional brand choices. Recheck the rendered page after changes.',
    '',
    '## Rendered design observations',
    '',
    ...(review.designFindings.length ? review.designFindings.flatMap((finding, index) => [
      `### ${index + 1}. ${finding.title}`,
      '',
      `**Measured:** ${finding.measured}`,
      `**Why it reads as templated:** ${finding.why}`,
      `**Change:** ${finding.change}`,
      `**Supported by guidelines:** ${finding.supportedBy.length ? finding.supportedBy.join(', ') : 'none matched'}`,
      `**Design guidance:** ${finding.skill.url}`,
      '',
    ]) : ['No rendered design signals were measured.', '']),
    '## Supporting guideline cues',
    '',
    ...(review.supportingCues.length ? review.supportingCues.map((cue) => `- **${cue.title}** (${cue.category}): ${cue.evidence} Change: ${cue.change} ${cue.skill.url}`) : ['No guideline cues matched.']),
    '',
  ].join('\n');
}
