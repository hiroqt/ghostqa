import type { DeliveredSource } from './slop-review';

export type TechnicalFinding = { id: string; category: 'Security' | 'Performance' | 'Delivery' | 'Policy'; title: string; detail: string; next: string };
export type TechnicalReview = { findings: TechnicalFinding[]; coverage: string; metrics: { resources: number; transferKB: number; largestKB: number; loadMs: number } };
export type TechnicalMetrics = { resources: number; bytes: number; largestBytes: number; loadMs: number; headers: Record<string, string> };

export function reviewTechnical(sources: DeliveredSource[], metrics: TechnicalMetrics): TechnicalReview {
  const html = sources.filter((source) => source.kind === 'html').map((source) => source.text).join('\n');
  const js = sources.filter((source) => source.kind === 'js').map((source) => source.text).join('\n') + '\n' +
    [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join('\n');
  const all = `${html}\n${js}`;
  const findings: TechnicalFinding[] = [];
  const add = (condition: boolean, finding: TechnicalFinding) => { if (condition) findings.push(finding); };
  add(/\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{25,}|AKIA[0-9A-Z]{16})\b/.test(all) || /\b(?:api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i.test(js), {
    id: 'credential-exposure', category: 'Security', title: 'Credential-like value delivered to browser',
    detail: 'A secret-shaped literal appeared in delivered HTML or JavaScript. The value is withheld; validity and privilege are unknown.',
    next: 'Check whether the value grants access; rotate it if sensitive and move privileged credentials server-side.',
  });
  add(/\b(?:TODO|FIXME|HACK)\b|\bconsole\.(?:log|debug)\s*\(|\b(?:describe|it|test)\.skip\s*\(/.test(js), {
    id: 'debug-code', category: 'Delivery', title: 'Debug or test code in delivered script',
    detail: 'A debug call, unfinished marker, or skipped-test marker appears in browser-delivered JavaScript.',
    next: 'Inspect the shipped bundle and remove unintended debug or test code.',
  });
  add(metrics.bytes >= 1_000_000 || metrics.largestBytes >= 500_000, {
    id: 'heavy-transfer', category: 'Performance', title: 'Large same-origin transfer',
    detail: `${Math.round(metrics.bytes / 1024)} KB observed across ${metrics.resources} same-origin responses; largest response ${Math.round(metrics.largestBytes / 1024)} KB.`,
    next: 'Inspect the largest asset and measure compressed transfer and user-perceived load on a representative device.',
  });
  add(metrics.loadMs >= 3_000, {
    id: 'slow-load', category: 'Performance', title: 'Slow page load event in this run',
    detail: `The load event took ${metrics.loadMs} ms in this Chromium run.`,
    next: 'Repeat on a representative device and connection; inspect server timing and render-blocking assets.',
  });
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi)].map((match) => match[1]);
  add(links.some((href) => /(?:[?&](?:debug|admin|role|isAdmin|skipAuth|token|key)=|\.\.|%2e%2e)/i.test(href)), {
    id: 'suspicious-link', category: 'Security', title: 'Link contains a security-sensitive parameter or path pattern',
    detail: 'A delivered link contains a debug, role, auth, token, or traversal-shaped pattern. Link targets and values are withheld.',
    next: 'Review server-side authorization and canonical URL handling. This observation does not demonstrate a bypass.',
  });
  const signup = /<input\b[^>]*type\s*=\s*["']password["']/i.test(html) || /<form\b[^>]*(?:sign.?up|register)/i.test(html);
  const cookieUi = /(?:cookie|tracking|analytics)\s+(?:consent|preferences|settings)/i.test(html);
  add(signup && !links.some((href) => /(?:terms|privacy|policy)/i.test(href)), {
    id: 'missing-policy-links', category: 'Policy', title: 'No Terms or Privacy link observed near a signup page',
    detail: 'Signup UI appeared in captured HTML, but no Terms or Privacy link was found in the captured links.',
    next: 'Check the rendered signup flow for accessible policy links and obtain a legal review if required.',
  });
  add(cookieUi && !/(?:accept|reject|decline|manage preferences)/i.test(html), {
    id: 'missing-consent', category: 'Policy', title: 'Consent choice not evident in captured markup',
    detail: 'Cookie or tracking consent language appeared, but common choice controls were not evident in captured HTML.',
    next: 'Inspect the rendered consent flow and verify applicable requirements with counsel.',
  });
  add(Object.keys(metrics.headers).length > 0 && !('content-security-policy' in metrics.headers), {
    id: 'missing-csp', category: 'Security', title: 'No Content Security Policy header observed',
    detail: 'The main page response did not include a Content-Security-Policy header.',
    next: 'Consider a restrictive CSP appropriate to this app and verify it against actual resources.',
  });
  return {
    findings,
    coverage: `Read-only review of ${sources.length} captured same-origin HTML/CSS/JS responses. Findings are signals, not verified exploits or compliance verdicts.`,
    metrics: { resources: metrics.resources, transferKB: Math.round(metrics.bytes / 1024), largestKB: Math.round(metrics.largestBytes / 1024), loadMs: metrics.loadMs },
  };
}
