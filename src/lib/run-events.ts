export async function readRunEvents(stream: ReadableStream<Uint8Array>, onEvent: (event: unknown) => void): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.length > 1_000_000) throw new Error('Run event too large');
        if (line) onEvent(JSON.parse(line));
      }
      if (pending.length > 1_000_000) throw new Error('Run event too large');
      if (done) break;
    }
    if (pending) throw new Error('Incomplete run event');
  } finally {
    reader.releaseLock();
  }
}

export type LiveEvaluationNarrative = {
  headline: string;
  where: string;
  what: string;
  actionTag: string;
};

export function describeLiveEvaluation(input: {
  mode: 'test' | 'slop';
  url: string;
  status: string;
  log: string[];
}): LiveEvaluationNarrative {
  const { mode, url, status, log } = input;
  const lastEntry = log[log.length - 1] ?? '';
  const isReplay = /^replay\s+/i.test(lastEntry) || /replay/i.test(status);
  const cleaned = lastEntry.replace(/^replay\s+/i, '').trim();
  const spaceIdx = cleaned.indexOf(' ');
  const verb = (spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx)).toLowerCase();
  const target = (spaceIdx === -1 ? '' : cleaned.slice(spaceIdx + 1).trim()) || url;

  const s = status.toLowerCase();

  if (mode === 'slop') {
    return {
      headline: 'Analyzing page design',
      where: s.includes('measuring')
        ? `Computed DOM & CSSOM styles on ${target}`
        : s.includes('reviewing')
          ? `Same-origin delivered HTML/CSS/JS on ${target}`
          : `Viewport & DOM canvas on ${target}`,
      what: s.includes('measuring')
        ? 'Capturing CDP DOM snapshot to measure computed styles, color palette, card geometry, typography scale, and layout rhythm.'
        : s.includes('reviewing')
          ? 'Cross-checking rendered design signals against delivered same-origin HTML/CSS/JS guideline cues.'
          : 'Loading page in isolated Chromium and masking sensitive inputs before inspecting the visual design.',
      actionTag: status || 'Design audit',
    };
  }

  if (isReplay) {
    return {
      headline: `Replaying ${verb || 'step'} on "${target}"`,
      where: `Fresh isolated browser context → ${target}`,
      what: 'Re-executing the exact action sequence in a fresh browser context to confirm whether the suspected HTTP 5xx/4xx failure reproduces deterministically.',
      actionTag: lastEntry || 'Fresh replay verification',
    };
  }

  if (s.includes('reasoning')) {
    return {
      headline: `Reasoning next step after ${verb || 'observing'} "${target}"`,
      where: `Sanitized DOM headings & controls on ${url}`,
      what: 'Analyzing the observed headings, interactive controls, and masked screenshot to decide the next safe browser action or finish.',
      actionTag: `${status} (${log.length} action${log.length === 1 ? '' : 's'} run)`,
    };
  }

  if (s.includes('evaluating') && verb === 'navigate') {
    return {
      headline: `Evaluating navigation outcome at ${target}`,
      where: `Document headings & HTTP status on ${target}`,
      what: 'Checking that the expected visible heading rendered after navigation with no new HTTP 5xx/4xx or console errors.',
      actionTag: `${status} · ${lastEntry}`,
    };
  }

  if (s.includes('observing')) {
    return {
      headline: `Observing rendered DOM & viewport on ${target}`,
      where: `Visible headings, form fields & controls at ${target}`,
      what: 'Masking sensitive inputs, capturing a live viewport screenshot, and extracting visible headings and interactive controls.',
      actionTag: `${status} · ${lastEntry || 'initial load'}`,
    };
  }

  if (s.includes('suggest') || s.includes('improvement') || s.includes('compiling')) {
    return {
      headline: `Synthesizing QA findings & suggestions for ${url}`,
      where: `Captured DOM snapshot & action trace (${log.length} steps)`,
      what: 'Locating improvement selectors on the viewport and compiling the final verification report.',
      actionTag: status,
    };
  }

  switch (verb) {
    case 'fill':
      return {
        headline: s.includes('evaluating')
          ? `Evaluating form state after filling "${target}"`
          : `Filling input field "${target}"`,
        where: `Form control labeled "${target}" on ${url}`,
        what: `Injecting synthetic test input into "${target}", masking the field in screenshots, and verifying the form state and console health.`,
        actionTag: lastEntry,
      };
    case 'click':
      return {
        headline: s.includes('evaluating')
          ? `Evaluating page response after clicking "${target}"`
          : `Evaluating interaction on "${target}"`,
        where: `Interactive control "${target}" on ${url}`,
        what: `Triggering "${target}", then comparing before/after visible headings and monitoring same-origin HTTP responses and console errors.`,
        actionTag: lastEntry,
      };
    case 'press':
      return {
        headline: `Evaluating keyboard action on "${target}"`,
        where: `Focused element "${target}" on ${url}`,
        what: `Dispatching key press on "${target}" and checking whether navigation, focus state, or form submission produces the expected heading.`,
        actionTag: lastEntry,
      };
    case 'scroll':
      return {
        headline: 'Evaluating below-the-fold viewport',
        where: `Scrollable document viewport (${target}px) on ${url}`,
        what: 'Scrolling the viewport to reveal lower sections and observing newly visible headings, controls, and network activity.',
        actionTag: lastEntry,
      };
    case 'navigate':
      return {
        headline: `Navigating & validating origin for ${target}`,
        where: `Document root & network guard at ${target}`,
        what: 'Verifying exact-origin allowlist policy, opening the URL in isolated Chromium, and monitoring initial HTTP responses.',
        actionTag: lastEntry,
      };
    default:
      return {
        headline: 'Launching guarded browser session',
        where: `Target origin ${url}`,
        what: 'Verifying URL policy gate, starting headless Chromium with network guards, and preparing initial page observation.',
        actionTag: status || 'Starting',
      };
  }
}
