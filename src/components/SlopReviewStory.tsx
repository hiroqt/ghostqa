'use client';

import { useState } from 'react';
import { buildSlopAgentGuide, SLOP_CUE_COUNT, type SlopReview } from '../lib/slop-review';

export function SlopReviewStory({ review }: { review: SlopReview }) {
  const [copyStatus, setCopyStatus] = useState('');
  const coverage = Math.round((review.matchedCount / SLOP_CUE_COUNT) * 100);
  const guide = review.status === 'story' ? buildSlopAgentGuide(review) : '';
  async function copyGuide() {
    try {
      await navigator.clipboard.writeText(guide);
      setCopyStatus('Markdown guide copied');
    } catch {
      setCopyStatus('Could not copy. Check clipboard permission and try again.');
    }
  }
  if (review.status === 'insufficient-evidence') return (
    <div role="status" className="slop-empty">
      <h3>Insufficient evidence for a findings story</h3>
      <p><strong>{coverage}%</strong> of detectable patterns matched ({review.matchedCount} of {SLOP_CUE_COUNT}).</p>
      <p>The delivered page source did not support six distinct patterns across three design or code areas. No AI authorship claim is made.</p>
    </div>
  );

  return (
    <div className="slop-story">
      <h3>Findings story</h3>
      <p className="slop-coverage"><strong>{coverage}%</strong> of detectable patterns matched ({review.matchedCount} of {SLOP_CUE_COUNT}). Pattern-heavy review suggested.</p>
      <p>Patterns do not prove AI authorship. Review these design and code choices in context.</p>
      <button type="button" onClick={copyGuide}>Copy agent guide (Markdown)</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <details className="slop-guide-preview">
        <summary>Preview Markdown guide</summary>
        <pre>{guide}</pre>
      </details>
      <ol aria-label="AI slop observations">
        {review.findings.map((finding) => <li key={finding.id}>
          <span className="slop-category">{finding.category}</span>
          <h4>{finding.title}</h4>
          <p><strong>Observed</strong> {finding.evidence}</p>
          <p><strong>Why this can feel like AI slop</strong> {finding.why}</p>
          <p><strong>What to avoid</strong> {finding.avoid}</p>
          <p><strong>Need to change</strong> {finding.change}</p>
          <p><a href={finding.skill.url} target="_blank" rel="noopener noreferrer">Design guidance</a></p>
        </li>)}
      </ol>
    </div>
  );
}
