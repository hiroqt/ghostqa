'use client';

import { useState } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import FlashIcon from '@hugeicons/core-free-icons/FlashIcon';
import Shield01Icon from '@hugeicons/core-free-icons/Shield01Icon';
import ShieldCheckIcon from '@hugeicons/core-free-icons/ShieldCheckIcon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import Structure01Icon from '@hugeicons/core-free-icons/Structure01Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import UniversalAccessIcon from '@hugeicons/core-free-icons/UniversalAccessIcon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import Wrench01Icon from '@hugeicons/core-free-icons/Wrench01Icon';
import type { Suggestion } from '../lib/contracts';

interface NoFindingStateProps {
  status: 'no-finding' | 'inconclusive';
  reason?: string;
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
          <HugeiconsIcon icon={categories.icon} size={13} strokeWidth={2} aria-hidden="true" /> {categories.label}
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
          <button type="button" className="suggestion-code-toggle" aria-expanded={showLocation} onClick={() => setShowLocation(!showLocation)}>
            <HugeiconsIcon icon={ViewIcon} size={14} strokeWidth={2} aria-hidden="true" />
            {showLocation ? 'Hide location' : 'Show on page'}
          </button>
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

function categorizeSuggestion(text: string): { label: string; slug: string; icon: IconSvgElement } {
  const t = text.toLowerCase();
  if (/aria|role|alt|label|contrast|keyboard|focus|screen.?reader|wcag|a11y/i.test(t))
    return { label: 'Accessibility', slug: 'a11y', icon: UniversalAccessIcon };
  if (/lazy|load|lcp|cls|performance|cache|compress|webp|avif|preload|defer/i.test(t))
    return { label: 'Performance', slug: 'perf', icon: FlashIcon };
  if (/semantic|heading|structure|h1|h2|html|landmark|section|nav/i.test(t))
    return { label: 'Structure', slug: 'structure', icon: Structure01Icon };
  if (/color|spacing|font|typo|responsive|mobile|layout|padding|margin/i.test(t))
    return { label: 'UX', slug: 'ux', icon: SparklesIcon };
  return { label: 'Code quality', slug: 'code', icon: Wrench01Icon };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NoFindingState({ status, reason, suggestions }: NoFindingStateProps) {
  const isNoFinding = status === 'no-finding';
  const cleanReason = reason?.replace(/^(?:no-finding|inconclusive):\s*/i, '').trim();

  return (
    <div
      className="no-finding-state"
      role="region"
      aria-label={isNoFinding ? 'No issues found' : 'Inconclusive result'}
    >
      {/* Animated shield icon */}
      <div className="no-finding-icon" aria-hidden="true">
        <HugeiconsIcon
          className="shield-icon"
          icon={isNoFinding ? ShieldCheckIcon : Shield01Icon}
          size={64}
          strokeWidth={1.75}
          color="#14b8a6"
          role="img"
          aria-label={isNoFinding ? 'Shield checkmark — all clear' : 'Shield icon'}
        />
      </div>

      {/* Headline */}
      <div className="no-finding-text">
        <h3 className="no-finding-headline">
          {isNoFinding ? 'All clear — no issues found' : 'Inconclusive — run ended safely'}
        </h3>
        <p className="no-finding-sub muted">
          {isNoFinding
            ? cleanReason || 'GhostQA completed the run without detecting any verified failures.'
            : `${cleanReason ? `${cleanReason}. ` : ''}The run completed but could not confirm or deny a failure. Try again for a definitive result.`}
        </p>
      </div>

      {isNoFinding && <div className="validation-success"><span aria-hidden="true"><HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2.5} /></span> Validation complete <small>No verified failure found</small></div>}

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
