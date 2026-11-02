'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import LinkSquare02Icon from '@hugeicons/core-free-icons/LinkSquare02Icon';
import { buildDesignAgentGuide, VERDICT_LABELS, type DesignReview } from '../lib/design-audit';
import { SLOP_CUE_COUNT } from '../lib/slop-review';

export function SlopReviewStory({ review }: { review: DesignReview }) {
  const [copyStatus, setCopyStatus] = useState('');
  const coverage = Math.round((review.supportingCues.length / SLOP_CUE_COUNT) * 100);
  const guide = buildDesignAgentGuide(review);
  async function copyGuide() {
    try {
      await navigator.clipboard.writeText(guide);
      setCopyStatus('Markdown guide copied');
    } catch {
      setCopyStatus('Could not copy. Check clipboard permission and try again.');
    }
  }
  const cues = review.supportingCues.length > 0 && (
    <details className="slop-cues">
      <summary>Supporting guideline cues ({review.supportingCues.length} of {SLOP_CUE_COUNT}, {coverage}%)</summary>
      <p>Source patterns matched against the guideline catalog. They support the rendered observations above and cannot produce a verdict alone.</p>
      <ol aria-label="Supporting guideline cues">
        {review.supportingCues.map((cue) => <li key={cue.id}>
          <span className="slop-category">{cue.category}</span>
          <h4>{cue.title}</h4>
          <p><strong>Observed in source</strong> {cue.evidence}</p>
          <p><strong>What to avoid</strong> {cue.avoid}</p>
          <p><strong>Need to change</strong> {cue.change}</p>
          <p><a href={cue.skill.url} target="_blank" rel="noopener noreferrer"><HugeiconsIcon icon={LinkSquare02Icon} size={13} strokeWidth={2} aria-hidden="true" /> Design guidance</a></p>
        </li>)}
      </ol>
    </details>
  );

  if (review.verdict === 'insufficient-evidence') return (
    <div role="status" className="slop-empty">
      <h3>Insufficient evidence for a design verdict</h3>
      <p>The rendered page had too little visible content to measure its design. No AI authorship claim is made.</p>
      {cues}
    </div>
  );

  return (
    <div className={`slop-story verdict-${review.verdict}`}>
      <h3>Design verdict</h3>
      <p className="slop-verdict"><strong>{VERDICT_LABELS[review.verdict]}</strong> <span>Design score {review.designScore}/100 · {review.confidence} confidence</span></p>
      <p>Measured from the rendered page; guideline cues are supporting detail. Neither proves AI authorship.</p>
      <button type="button" onClick={copyGuide}><HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={2} aria-hidden="true" /> Copy agent guide (Markdown)</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <details className="slop-guide-preview">
        <summary>Preview Markdown guide</summary>
        <pre>{guide}</pre>
      </details>
      {review.designFindings.length > 0 ? (
        <ol aria-label="Rendered design observations">
          {review.designFindings.map((finding) => <li key={finding.id}>
            <span className="slop-category">{finding.aspect} · {finding.strength}</span>
            <h4>{finding.title}</h4>
            <p><strong>Measured on the page</strong> {finding.measured}</p>
            <p><strong>Why this reads as AI slop</strong> {finding.why}</p>
            <p><strong>Need to change</strong> {finding.change}</p>
            {finding.supportedBy.length > 0 && <p className="slop-support"><strong>Supported by guidelines</strong> {finding.supportedBy.join(', ')}</p>}
            <p><a href={finding.skill.url} target="_blank" rel="noopener noreferrer"><HugeiconsIcon icon={LinkSquare02Icon} size={13} strokeWidth={2} aria-hidden="true" /> Design guidance</a></p>
          </li>)}
        </ol>
      ) : <p>No templated design signals were measured on the rendered page.</p>}
      {cues}
    </div>
  );
}
