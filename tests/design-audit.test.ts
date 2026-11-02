import { expect, test } from 'vitest';
import {
  buildDesignAgentGuide, parseDomSnapshot, RENDERED_STYLE_PROPERTIES, reviewDesign,
  type RenderedElement, type RenderedPage, type RenderedText,
} from '../src/lib/design-audit';

const viewport = { width: 1280, height: 720 };
const baseStyle: RenderedElement['style'] = {
  'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'backdrop-filter': 'none',
  'border-top-left-radius': '0px', 'box-shadow': 'none', 'font-family': 'Fraunces, serif', 'font-size': '16px',
  'text-align': 'start', 'background-clip': 'border-box', '-webkit-background-clip': 'border-box', visibility: 'visible', opacity: '1',
};
const el = (tag: string, box: [number, number, number, number], style: Partial<RenderedElement['style']> = {}): RenderedElement =>
  ({ tag, x: box[0], y: box[1], width: box[2], height: box[3], style: { ...baseStyle, ...style } });
const text = (box: [number, number, number, number], style: Partial<RenderedText['style']> = {}, length = 20): RenderedText =>
  ({ x: box[0], y: box[1], width: box[2], height: box[3], length, style: { ...baseStyle, ...style } });

const card = { 'background-color': 'rgba(255, 255, 255, 0.8)', 'backdrop-filter': 'blur(12px)', 'border-top-left-radius': '32px', 'box-shadow': 'rgba(0, 0, 0, 0.2) 0px 20px 40px 0px' };
const slopPage: RenderedPage = {
  viewport,
  elements: [
    el('BODY', [8, 12, 1264, 265], { 'background-image': 'linear-gradient(90deg, rgb(103, 66, 199), rgb(49, 85, 255))', 'font-family': 'sans-serif' }),
    el('DIV', [8, 85, 1264, 58], card), el('DIV', [8, 143, 1264, 58], card), el('DIV', [8, 201, 1264, 58], card),
  ],
  texts: [
    text([32, 24, 457, 37], { 'font-size': '32px', 'font-family': 'sans-serif' }),
    text([28, 105, 133, 18], { 'font-family': 'sans-serif' }), text([28, 163, 108, 18], { 'font-family': 'sans-serif' }),
    text([28, 221, 123, 18], { 'font-family': 'sans-serif' }),
  ],
};
const sourcePatterns = [{ kind: 'html' as const, text: `<style>
  body { background: linear-gradient(90deg, #7155cc, #3155ff); }
  .card { backdrop-filter: blur(12px); border-radius: 32px; }
  .title { color: white !important; margin: 10px !important; padding: 12px !important; }
</style><div class="card">One</div><div class="card">Two</div><div class="card">Three</div>
<a href="#">Go</a><script>console.log('x'); // TODO</script>` }];

test('requests the computed style properties it audits', () => {
  for (const property of ['background-image', 'backdrop-filter', 'border-top-left-radius', 'box-shadow', 'font-family', 'font-size', 'text-align', 'background-clip']) {
    expect(RENDERED_STYLE_PROPERTIES).toContain(property);
  }
});

test('parses a CDP DOM snapshot into visible elements and text without keeping page text', () => {
  const strings = ['#document', 'HTML', 'BODY', '#text', 'Secret customer name', ...RENDERED_STYLE_PROPERTIES.map(() => 'x'), 'none', 'visible', '1', 'hidden'];
  const style = (visibility: string) => RENDERED_STYLE_PROPERTIES.map((property) => strings.indexOf(property === 'visibility' ? visibility : property === 'opacity' ? '1' : 'none'));
  const raw = {
    strings,
    documents: [{
      nodes: { nodeType: [9, 1, 1, 3, 3], nodeName: [0, 1, 2, 3, 3], parentIndex: [-1, 0, 1, 2, 2] },
      layout: {
        nodeIndex: [0, 1, 2, 3, 4],
        bounds: [[0, 0, 1280, 720], [0, 0, 1280, 300], [8, 8, 1264, 280], [10, 10, 200, 20], [10, 40, 0, 0]],
        styles: [[], style('visible'), style('visible'), style('visible'), style('hidden')],
        text: [-1, -1, -1, 4, 4],
      },
    }],
  };
  const page = parseDomSnapshot(raw, viewport);
  expect(page.elements.map((element) => element.tag)).toEqual(['HTML', 'BODY']);
  expect(page.texts).toHaveLength(1);
  expect(page.texts[0].length).toBe('Secret customer name'.length);
  expect(JSON.stringify(page)).not.toContain('Secret customer name');
});

test('stamps a page whose rendered design is templated, with guideline cues as support', () => {
  const review = reviewDesign(slopPage, sourcePatterns);
  expect(review.verdict).toBe('ai-slop-design');
  expect(review.confidence).toBe('high');
  expect(review.designScore).toBeGreaterThanOrEqual(50);
  const ids = review.designFindings.map((finding) => finding.id);
  for (const id of ['violet-gradient-canvas', 'glass-surfaces', 'uniform-cards', 'one-radius', 'soft-shadow', 'flat-type-scale', 'single-default-font']) expect(ids).toContain(id);
  const cards = review.designFindings.find((finding) => finding.id === 'uniform-cards')!;
  expect(cards.measured).toMatch(/3 .*1264×58px/);
  expect(cards.supportedBy).toContain('Repeated card grid');
  expect(review.designFindings.find((finding) => finding.id === 'glass-surfaces')!.supportedBy).toContain('Blurred glass surface');
  for (const finding of review.designFindings) {
    expect(finding.measured && finding.why && finding.change).toBeTruthy();
    expect(finding.skill.url).toMatch(/^https:\/\/github\.com\//);
  }
});

test('guideline cues alone cannot stamp: pattern-heavy source with a plain rendered design', () => {
  const plain: RenderedPage = {
    viewport,
    elements: [el('BODY', [0, 0, 1280, 900], { 'background-color': 'rgb(250, 250, 250)' }), el('SECTION', [80, 120, 520, 300], { 'background-color': 'rgb(255, 255, 255)', 'border-top-left-radius': '4px' })],
    texts: [text([80, 40, 600, 64], { 'font-size': '56px' }), text([80, 140, 400, 28], { 'font-size': '22px' }), text([80, 190, 480, 24]), text([80, 230, 480, 24], { 'font-size': '14px' })],
  };
  const review = reviewDesign(plain, sourcePatterns);
  expect(review.patternReview.status).toBe('story');
  expect(review.verdict).toBe('ai-slop-pattern');
  expect(review.designScore).toBeLessThan(25);
});

test('a plain rendered page with no pattern story is a distinct design', () => {
  const plain: RenderedPage = {
    viewport,
    elements: [el('BODY', [0, 0, 1280, 900])],
    texts: [text([80, 40, 600, 64], { 'font-size': '56px' }), text([80, 140, 400, 28], { 'font-size': '22px' }), text([80, 190, 480, 24])],
  };
  const review = reviewDesign(plain, [{ kind: 'html', text: '<main><h1>Plain</h1></main>' }]);
  expect(review).toMatchObject({ verdict: 'distinct-design', designScore: 0, designFindings: [] });
});

test('weak signals alone produce mixed signals, not a stamp', () => {
  const page: RenderedPage = {
    viewport,
    elements: [el('BODY', [0, 0, 1280, 900], { 'font-family': 'Inter, sans-serif' })],
    texts: [0, 1, 2, 3].map((index) => text([440, 40 + index * 60, 400, 24], { 'font-family': 'Inter, sans-serif', 'text-align': 'center' })),
  };
  const review = reviewDesign(page, []);
  expect(review.designFindings.every((finding) => finding.strength === 'weak')).toBe(true);
  expect(review.designScore).toBeGreaterThanOrEqual(25);
  expect(review.verdict).toBe('mixed');
});

test('detects visible gradient text from computed styles', () => {
  const page: RenderedPage = {
    viewport,
    elements: [el('BODY', [0, 0, 1280, 900]), el('H1', [80, 40, 600, 64], { 'background-image': 'linear-gradient(90deg, rgb(255, 0, 128), rgb(0, 200, 255))', 'background-clip': 'text' })],
    texts: [text([80, 40, 600, 64], { 'font-size': '56px' }), text([80, 140, 400, 28], { 'font-size': '22px' }), text([80, 190, 480, 24])],
  };
  expect(reviewDesign(page, []).designFindings.map((finding) => finding.id)).toContain('gradient-text');
});

test('too little rendered content or a missing snapshot is insufficient evidence', () => {
  const sparse: RenderedPage = { viewport, elements: [el('BODY', [8, 8, 1264, 40])], texts: [text([8, 8, 300, 37], { 'font-size': '32px' })] };
  expect(reviewDesign(sparse, [{ kind: 'html', text: '<main><h1>Demo is ready</h1></main>' }]).verdict).toBe('insufficient-evidence');
  const missing = reviewDesign(null, sourcePatterns);
  expect(missing.verdict).toBe('insufficient-evidence');
  expect(missing.supportingCues.length).toBeGreaterThan(0);
});

test('agent guide leads with the design verdict and keeps guideline cues as support', () => {
  const guide = buildDesignAgentGuide(reviewDesign(slopPage, sourcePatterns));
  expect(guide).toContain('# GhostQA design review handoff');
  expect(guide).toContain('**Verdict:** AI slop by design');
  expect(guide.indexOf('## Rendered design observations')).toBeLessThan(guide.indexOf('## Supporting guideline cues'));
  expect(guide).toContain('**Measured:**');
  expect(guide).toContain('**Supported by guidelines:** Repeated card grid');
  expect(guide).not.toContain("console.log('x')");
});

