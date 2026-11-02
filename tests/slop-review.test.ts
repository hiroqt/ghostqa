import { expect, test } from 'vitest';
import { buildSlopAgentGuide, reviewSlopPatterns } from '../src/lib/slop-review';

const html = `
<style>
  body { background: linear-gradient(90deg, #7155cc, #3155ff); }
  .card { backdrop-filter: blur(12px); border-radius: 32px; box-shadow: 0 20px 40px #0003; }
  .title { color: white !important; margin: 10px !important; padding: 12px !important; }
</style>
<div class="card">One</div><div class="card">Two</div><div class="card">Three</div>
<a href="#">Get started</a>
<script>console.log('sensitive-debug-value'); // TODO: implement submit</script>`;

test('returns a story only for six distinct supported patterns', () => {
  const result = reviewSlopPatterns([{ kind: 'html', text: html }]);
  expect(result.status).toBe('story');
  expect(result.findings.length).toBeGreaterThan(5);
  expect(new Set(result.findings.map((finding) => finding.id)).size).toBe(result.findings.length);
  for (const finding of result.findings) {
    expect(finding.why).toBeTruthy();
    expect(finding.avoid).toBeTruthy();
    expect(finding.change).toBeTruthy();
    expect(finding.evidence).toBeTruthy();
    expect(finding.skill.url).toMatch(/^https:\/\/github\.com\//);
  }
  expect(JSON.stringify(result)).not.toContain('sensitive-debug-value');
  const guide = buildSlopAgentGuide(result);
  expect(guide).toContain('# GhostQA design review handoff');
  expect(guide).toContain('## 1. Generic gradient backdrop');
  expect(guide).toContain('**Observed:** A CSS background uses a linear or radial gradient.');
  expect(guide).toContain('**Why review it:**');
  expect(guide).toContain('**Change:**');
  expect(guide).toContain('Verify each observation in the rendered UI');
  expect(guide).not.toContain('sensitive-debug-value');
});

test('does not pad a sparse page or claim AI authorship', () => {
  const result = reviewSlopPatterns([{ kind: 'html', text: '<main><h1>Healthy</h1></main>' }]);
  expect(result).toEqual({ status: 'insufficient-evidence', findings: [], matchedCount: 0 });
  expect(reviewSlopPatterns([{ kind: 'html', text: '<style>body { background-color: #f5f1e8; }</style><main><h1>Healthy</h1></main>' }]).status).toBe('insufficient-evidence');
});

test('ignores unsupported resource types', () => {
  const result = reviewSlopPatterns([{ kind: 'other', text: html }]);
  expect(result.status).toBe('insufficient-evidence');
});

test('does not mistake prose examples for CSS and JavaScript source', () => {
  const result = reviewSlopPatterns([{ kind: 'html', text: `<main><p>Try background: linear-gradient(red, blue), backdrop-filter: blur(12px), border-radius: 32px, color: red !important; margin: 0 !important; padding: 0 !important; console.log('hello'), and TODO in an example.</p><div class="card"></div><div class="card"></div><div class="card"></div><a href="#">Placeholder</a></main>` }]);
  expect(result.status).toBe('insufficient-evidence');
});

test('covers a wider set of Impeccable catalog cues with matching GitHub skills', () => {
  const source = `<style>
    body { background: repeating-linear-gradient(90deg, #eee 0 1px, transparent 1px 20px); font-family: Inter, sans-serif; }
    .hero { background: linear-gradient(90deg, purple, cyan); background-clip: text; color: transparent; letter-spacing: -0.08em; }
    .card { border: 1px solid #ddd; border-left: 6px solid purple; border-radius: 32px; box-shadow: 0 30px 60px #0003; }
    .status-dot { animation: pulse 1s infinite; }
    .marquee { animation: marquee 20s linear infinite; }
    h1 { font-family: Georgia, serif; font-style: italic; }
  </style>
  <span class="eyebrow">The future</span><h1>Supercharge your workflow</h1>
  <p>One claim — another claim — a third claim — a fourth claim.</p>
  <div class="card"><span class="icon">✦</span><h2>Feature</h2></div>`;
  const result = reviewSlopPatterns([{ kind: 'html', text: source }]);
  expect(result.status).toBe('story');
  const ids = new Set(result.findings.map((finding) => finding.id));
  for (const id of ['repeating-stripes', 'gradient-text', 'side-tab', 'hairline-shadow', 'overused-font', 'crushed-spacing', 'pulsing-status', 'auto-marquee', 'italic-serif-hero', 'label-above-heading', 'generic-claim', 'em-dash-overuse', 'icon-tile']) expect(ids.has(id)).toBe(true);
  expect(result.findings.every((finding) => finding.skill.name.startsWith('Impeccable '))).toBe(true);
  expect(result.findings.every((finding) => finding.skill.url.startsWith('https://github.com/pbakaus/impeccable/'))).toBe(true);
});

test('ignores commented-out markup and CSS patterns', () => {
  const source = `<!-- <div class="card"></div><div class="card"></div><div class="card"></div><a href="#">Fake</a> -->
    <style>/* body { background: repeating-linear-gradient(red, blue); font-family: Inter; letter-spacing: -0.08em; } .card { border-left: 6px solid red; border-radius: 32px; border: 1px solid red; box-shadow: 0 30px 60px red; } */</style>
    <main><h1>Simple page</h1></main>`;
  expect(reviewSlopPatterns([{ kind: 'html', text: source }]).status).toBe('insufficient-evidence');
});

test('reviews component, copy, background, type, motion, and image patterns separately', () => {
  const source = `<style>
    .canvas { background-image: linear-gradient(to right, #ddd 1px, transparent 1px), linear-gradient(to bottom, #ddd 1px, transparent 1px); background-size: 24px 24px; }
    .hero { background: radial-gradient(circle, #8650ff 0, transparent 70%); }
    body { background-color: #f5f1e8; }
    h1 { font-size: 72px; }
    h2 { font-size: 16px; } p { font-size: 15px; }
    .body-copy { text-transform: uppercase; }
    .glow { background: #111; box-shadow: 0 0 30px #00ffff; }
    .dialog { transition: transform .5s cubic-bezier(.2, 1.4, .3, 1); }
  </style>
  <main><div class="canvas"></div><section class="hero">
    <span class="badge">New</span><h1>Everything your whole team needs to ship much faster</h1>
    <span class="section-number">01</span><h2>Features</h2>
    <div class="card"><div class="card">Nested feature</div></div>
    <p class="body-copy">THIS IS A LONG PASSAGE OF BODY TEXT SET IN ALL CAPS FOR NO READING BENEFIT.</p>
    <p>Not a feature. A platform. Stop the growth theater.</p>
    <img src="" alt="Placeholder illustration">
  </section></main>`;
  const result = reviewSlopPatterns([{ kind: 'html', text: source }]);
  expect(result.status).toBe('story');
  const ids = new Set(result.findings.map((finding) => finding.id));
  for (const id of ['decorative-grid', 'radial-halo', 'cream-palette', 'oversized-hero', 'flat-type', 'all-caps-body', 'dark-neon', 'elastic-motion', 'hero-badge', 'numbered-label', 'nested-cards', 'forced-contrast', 'theater-copy', 'placeholder-image']) expect(ids.has(id)).toBe(true);
  expect(result.findings.every((finding) => finding.skill.url.startsWith('https://github.com/pbakaus/impeccable/'))).toBe(true);
  expect(JSON.stringify(result)).not.toContain('Stop the growth theater');
});

test('recognizes common equivalent source forms without new cue IDs', () => {
  const source = `${html}
  <style>h1 { font-size: 4rem; } p { text-transform: uppercase; }
  .status-dot { animation: 1s infinite pulse; }</style>
  <section class="card"><article class="card">Nested</article></section>
  <h1>Everything your team needs to ship faster together today</h1>
  <p>This sentence is mixed case in the source but CSS makes it uppercase on screen.</p>
  <p>World-class service for every team.</p>`;
  const result = reviewSlopPatterns([{ kind: 'html', text: source }]);
  expect(result.status).toBe('story');
  for (const id of ['nested-cards', 'oversized-hero', 'all-caps-body', 'pulsing-status', 'generic-claim']) expect(result.findings.some((finding) => finding.id === id)).toBe(true);
});

test('does not stamp one pile of decorative background treatments', () => {
  const source = `<style>
    .a { backdrop-filter: blur(10px); background: repeating-linear-gradient(red, blue); }
    .b { background: linear-gradient(red, blue); background-clip: text; }
    .c { background-image: linear-gradient(red 1px, transparent 1px), linear-gradient(blue 1px, transparent 1px); background-size: 20px 20px; }
    .d { background: radial-gradient(circle, purple, transparent); }
    .e { background-color: #f5f1e8; }
    .f { background: #111; box-shadow: 0 0 30px #00ffff; }
  </style><main><h1>Example</h1></main>`;
  expect(reviewSlopPatterns([{ kind: 'html', text: source }])).toMatchObject({ status: 'insufficient-evidence', findings: [], matchedCount: 7 });
  const twoAreas = `${source}<a href="#">More</a><script>console.log('debug'); // TODO</script>`;
  expect(reviewSlopPatterns([{ kind: 'html', text: twoAreas }])).toMatchObject({ status: 'insufficient-evidence', findings: [], matchedCount: 10 });
});
