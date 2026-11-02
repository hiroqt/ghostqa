'use client';

import { useState } from 'react';
import type { Suggestion } from '../lib/contracts';

interface NoFindingStateProps {
  status: 'no-finding' | 'inconclusive';
  suggestions: Suggestion[];
}

// ─── Animated location chip ──────────────────────────────────────────────────

function LocationChip({ location }: { location: string }) {
  return (
    <span className="suggestion-location-chip" aria-label={`Affected element: ${location}`}>
      <span className="chip-dot" aria-hidden="true" />
      <code>{location}</code>
    </span>
  );
}

// ─── Single suggestion row ───────────────────────────────────────────────────

function SuggestionRow({ suggestion, index }: { suggestion: Suggestion; index: number }) {
  const categories = categorizeSuggestion(suggestion.text);
  const [showLocation, setShowLocation] = useState(false);
  const visual = categories.slug === 'ux' || categories.slug === 'a11y' || categories.slug === 'structure';
  const [beforeCode, afterCode] = suggestion.codeSnippet.split(/<!--\s*after\s*-->/i);

  return (
    <li
      className="suggestion-row"
      style={{ '--row-index': index } as React.CSSProperties}
      aria-label={suggestion.text}
    >
      {/* Category badge + location chip on one line */}
      <div className="suggestion-meta">
        <span className={`suggestion-category-badge category-${categories.slug}`} aria-label={`Category: ${categories.label}`}>
          {categories.icon} {categories.label}
        </span>
        <LocationChip location={suggestion.location} />
      </div>

      {/* Main text */}
      <p className="suggestion-text">{suggestion.text}</p>

      <p className="suggestion-reason"><strong>Why</strong> {suggestion.reason || 'This change may improve the page experience; inspect the matched element before applying it.'}</p>

      {/* Selector pill */}
      {suggestion.selector && (
        <div className="suggestion-selector" aria-label={`CSS selector: ${suggestion.selector}`}>
          <span className="selector-label" aria-hidden="true">selector</span>
          <code>{suggestion.selector}</code>
        </div>
      )}

      {suggestion.image && suggestion.bounds && (
        <div className="suggestion-location-view">
          <button type="button" className="suggestion-code-toggle" aria-expanded={showLocation} onClick={() => setShowLocation(!showLocation)}>{showLocation ? 'Hide location' : 'Show on page'}</button>
          {showLocation && <div className="suggestion-image-frame"><img src={suggestion.image} alt={`Masked page showing ${suggestion.location}`} /><span className="suggestion-image-marker" style={{ left: `${suggestion.bounds.x}%`, top: `${suggestion.bounds.y}%`, width: `${suggestion.bounds.width}%`, height: `${suggestion.bounds.height}%` }} /></div>}
        </div>
      )}
      {visual && suggestion.image && suggestion.bounds ? (
        <div className="suggestion-comparison" aria-label="Before and proposed after preview">
          <figure><figcaption>Before · captured page</figcaption><div className="suggestion-image-frame"><img src={suggestion.image} alt={`Current page near ${suggestion.location}`} /><span className="suggestion-image-marker" style={{ left: `${suggestion.bounds.x}%`, top: `${suggestion.bounds.y}%`, width: `${suggestion.bounds.width}%`, height: `${suggestion.bounds.height}%` }} /></div></figure>
          <figure><figcaption>After · concept only</figcaption><div className="suggestion-image-frame concept"><img src={suggestion.image} alt={`Concept preview based on the current page near ${suggestion.location}`} /><span className="suggestion-image-marker" style={{ left: `${suggestion.bounds.x}%`, top: `${suggestion.bounds.y}%`, width: `${suggestion.bounds.width}%`, height: `${suggestion.bounds.height}%` }} /><span className="concept-label">{suggestion.text}</span></div></figure>
        </div>
      ) : suggestion.codeSnippet.trim() ? (
        <div className="suggestion-code-comparison"><div><strong>Before · example</strong><pre><code>{afterCode ? beforeCode.trim() : 'Current source not available from page snapshot'}</code></pre></div><div><strong>After · suggested code</strong><pre><code>{(afterCode || suggestion.codeSnippet).trim()}</code></pre></div></div>
      ) : null}
    </li>
  );
}

// ─── Category detection helper ───────────────────────────────────────────────

function categorizeSuggestion(text: string): { label: string; slug: string; icon: string } {
  const t = text.toLowerCase();
  if (/aria|role|alt|label|contrast|keyboard|focus|screen.?reader|wcag|a11y/i.test(t))
    return { label: 'Accessibility', slug: 'a11y', icon: '♿' };
  if (/lazy|load|lcp|cls|performance|cache|compress|webp|avif|preload|defer/i.test(t))
    return { label: 'Performance', slug: 'perf', icon: '⚡' };
  if (/semantic|heading|structure|h1|h2|html|landmark|section|nav/i.test(t))
    return { label: 'Structure', slug: 'structure', icon: '🏗' };
  if (/color|spacing|font|typo|responsive|mobile|layout|padding|margin/i.test(t))
    return { label: 'UX', slug: 'ux', icon: '✦' };
  return { label: 'Code quality', slug: 'code', icon: '🔧' };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NoFindingState({ status, suggestions }: NoFindingStateProps) {
  const isNoFinding = status === 'no-finding';

  return (
    <div
      className="no-finding-state"
      role="region"
      aria-label={isNoFinding ? 'No issues found' : 'Inconclusive result'}
    >
      {/* Animated shield icon */}
      <div className="no-finding-icon" aria-hidden="true">
        <svg
          className="shield-icon"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={isNoFinding ? 'Shield checkmark — all clear' : 'Shield icon'}
        >
          <path
            className="shield-path"
            d="M24 4 L40 10 L40 22 C40 32 32 40 24 44 C16 40 8 32 8 22 L8 10 Z"
            stroke="#14b8a6"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {isNoFinding && (
            <path
              className="check-path"
              d="M16 24 L21 29 L32 18"
              stroke="#14b8a6"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      {/* Headline */}
      <div className="no-finding-text">
        <h3 className="no-finding-headline">
          {isNoFinding ? 'All clear — no issues found' : 'Inconclusive — run ended safely'}
        </h3>
        <p className="no-finding-sub muted">
          {isNoFinding
            ? 'GhostQA completed the run without detecting any verified failures.'
            : 'The run completed but could not confirm or deny a failure. Try again for a definitive result.'}
        </p>
      </div>

      {isNoFinding && <div className="validation-success"><span aria-hidden="true">✓</span> Validation complete <small>No verified failure found</small></div>}

      {/* Suggestions panel */}
      {suggestions.length > 0 && (
        <div className="suggestions-card" aria-label="Improvement suggestions for the tested page">
          <div className="suggestions-header">
            <span className="suggestions-label">Improvement suggestions</span>
            <span className="suggestions-count" aria-label={`${suggestions.length} suggestions`}>
              {suggestions.length}
            </span>
          </div>
          <p className="suggestions-intro muted">
            Based on the page snapshot. Visual after previews are concepts; inspect code changes before applying them.
          </p>
          <ul className="suggestions-list" aria-label="Improvement suggestions list">
            {suggestions.map((suggestion, index) => (
              <SuggestionRow key={index} suggestion={suggestion} index={index} />
            ))}
          </ul>
        </div>
      )}

      {suggestions.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: '8px' }}>
          No suggestions available — try again with a live Meta model connection.
        </p>
      )}
    </div>
  );
}
