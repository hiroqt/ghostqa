'use client';

import { useState } from 'react';
import type { RunReport } from '../lib/report';

type Finding = NonNullable<RunReport['finding']>;

interface FindingCardProps {
  finding: Finding;
  screenshot?: string;
  highlight?: { x: number; y: number; width: number; height: number };
}

export function FindingCard({ finding, screenshot, highlight }: FindingCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finding.reproductionTest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable; silently ignore
    }
  }

  return (
    <div className="finding-card" role="region" aria-label="Verified finding details">
      <div className="finding-badge" aria-label="Severity: verified finding">
        <span>VERIFIED FINDING</span>
      </div>

      <dl className="finding-diff">
        <dt>Expected</dt>
        <dd>{finding.expected}</dd>
        <dt>Actual</dt>
        <dd>{finding.actual}</dd>
      </dl>

      {screenshot && (
        <div className={`evidence-view ${expanded ? 'expanded' : ''}`}>
          <button type="button" className="copy-btn" onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Close enlarged evidence image' : 'Enlarge evidence image'}>
            {expanded ? 'Close image' : 'Enlarge image'}
          </button>
          <div className="evidence-frame">
            <img className={`finding-screenshot ${expanded ? 'expanded' : ''}`} src={screenshot}
              alt="Masked browser screenshot of the verified failure" />
            {highlight && <span className="evidence-highlight" style={{ left: `${highlight.x}%`, top: `${highlight.y}%`, width: `${highlight.width}%`, height: `${highlight.height}%` }}>
              <span>Observed outcome</span>
            </span>}
          </div>
        </div>
      )}

      <h3 className="finding-section-title">Replay steps</h3>
      <ol className="finding-trace" aria-label="Action trace">
        {finding.replaySteps.map((action, index) => (
          <li key={index}>
            <span className="trace-step-num">{index + 1}</span>
            <span className="trace-action">{action.type}</span>
            {action.target && <span className="trace-target">{action.target}</span>}
            {action.type === 'navigate' && action.value && (
              <span className="trace-value">{action.value}</span>
            )}
          </li>
        ))}
      </ol>

      <details className="finding-details">
        <summary>HTTP failures ({finding.httpFailures.length})</summary>
        {finding.httpFailures.length > 0 ? (
          <ul>
            {finding.httpFailures.map((item, index) => (
              <li key={index}>
                <span className="http-status">{item.status}</span> {item.url}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No HTTP failures recorded</p>
        )}
      </details>

      <details className="finding-details">
        <summary>Console errors ({finding.consoleErrors.length})</summary>
        {finding.consoleErrors.length > 0 ? (
          <ul>
            {finding.consoleErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No console errors recorded</p>
        )}
      </details>

      <div className="finding-replay-section">
        <div className="finding-replay-header">
          <h3 className="finding-section-title" style={{ margin: 0 }}>Playwright reproduction test</h3>
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy Playwright test to clipboard'}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="code-block" role="region" aria-label="Playwright reproduction test code">
          <code>{finding.reproductionTest}</code>
        </pre>
      </div>
    </div>
  );
}
