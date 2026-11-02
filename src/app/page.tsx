'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import RadioIcon from '@hugeicons/core-free-icons/RadioIcon';
import RecordIcon from '@hugeicons/core-free-icons/RecordIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import type { RunReport } from '../lib/report';
import { COMMON_TEST_GOALS } from '../lib/contracts';
import { describeLiveEvaluation, readRunEvents } from '../lib/run-events';
import { FindingCard } from '../components/FindingCard';
import { NoFindingState } from '../components/NoFindingState';
import { SlopReviewStory } from '../components/SlopReviewStory';
import './style.css';

const liveMode = process.env.NEXT_PUBLIC_ALLOW_LIVE_SITES === 'true';
const demoOrigin = process.env.NEXT_PUBLIC_DEMO_ORIGIN ?? 'http://127.0.0.1:3001';

// ─── Stage definitions ────────────────────────────────────────────────────

type Stage =
  | 'Idle'
  | 'Validating URL'
  | 'Observing'
  | 'Reasoning'
  | 'Executing'
  | 'Evaluating'
  | 'Replaying'
  | 'Report';

const ALL_STAGES: Stage[] = [
  'Idle',
  'Validating URL',
  'Observing',
  'Reasoning',
  'Executing',
  'Evaluating',
  'Replaying',
  'Report',
];

function statusToStage(message: string, hasAction: boolean): Stage {
  const m = message.toLowerCase();
  if (m.includes('starting') || m.includes('launching')) return 'Validating URL';
  if (m.includes('observing') || m.includes('measuring')) return 'Observing';
  if (m.includes('reasoning') || m.includes('deciding')) return 'Reasoning';
  if (m.includes('evaluating') || m.includes('compiling')) return 'Evaluating';
  if (m.includes('reviewing')) return 'Executing';
  if (m.includes('navigate') || m.includes('click') || m.includes('fill') || m.includes('press')) return 'Executing';
  if (m.includes('replay')) return 'Replaying';
  if (m === 'complete') return 'Report';
  if (hasAction) return 'Executing';
  return 'Idle';
}

function stageIndex(stage: Stage): number {
  return ALL_STAGES.indexOf(stage);
}

function isAnimatingStage(stage: Stage): boolean {
  return stage === 'Reasoning' || stage === 'Executing' || stage === 'Validating URL';
}

export default function Home() {
  const [url, setUrl] = useState(liveMode ? '' : `${demoOrigin}/register`);
  const [goal, setGoal] = useState(liveMode ? '' : 'Try registering');
  const [reviewType, setReviewType] = useState<'test' | 'slop'>('test');
  const [status, setStatus] = useState('Ready');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const [screenshot, setScreenshot] = useState('');
  const [preview, setPreview] = useState('');
  const observationRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [showSlopStory, setShowSlopStory] = useState(false);
  const [slopShowcase, setSlopShowcase] = useState<'off' | 'stamp' | 'settling'>('off');
  const [highlight, setHighlight] = useState<{ x: number; y: number; width: number; height: number }>();
  const [activeStage, setActiveStage] = useState<Stage>('Idle');
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());
  const [showWorkspace, setShowWorkspace] = useState(false);

  function goToWorkspace() {
    setShowWorkspace(true);
  }

  useEffect(() => {
    if (showWorkspace) {
      urlInputRef.current?.focus({ preventScroll: true });
    }
  }, [showWorkspace]);

  useEffect(() => {
    if (report?.designReview?.verdict === 'ai-slop-design' && (!preview || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      setShowSlopStory(true);
      setSlopShowcase('off');
    }
  }, [report, preview]);

  useEffect(() => {
    if (report?.designReview && preview && slopShowcase === 'off') {
      observationRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      observationRef.current?.focus({ preventScroll: true });
    }
  }, [report, preview, slopShowcase]);

  function advanceStage(next: Stage) {
    if (next === 'Idle') return;
    setActiveStage((current) => {
      const ci = stageIndex(current);
      const ni = stageIndex(next);
      setCompletedStages((prev) => {
        const updated = new Set(prev);
        if (current !== 'Idle' && current !== next) updated.add(current);
        for (let i = 1; i < Math.max(ci, ni); i++) updated.add(ALL_STAGES[i]);
        return updated;
      });
      return next;
    });
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunning(true);
    setStatus('Starting');
    setLog([]);
    setReport(null);
    setScreenshot('');
    setPreview('');
    setShowSlopStory(false);
    setSlopShowcase('off');
    setHighlight(undefined);
    setActiveStage('Validating URL');
    setCompletedStages(new Set());

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, goal, mode: reviewType }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Run rejected',
        );
      }
      if (!response.body) throw new Error('Run stream unavailable');

      let hasAction = false;

      await readRunEvents(response.body, (event) => {
        if (!event || typeof event !== 'object' || !('type' in event)) return;

        if (event.type === 'status' && 'message' in event && typeof event.message === 'string') {
          setStatus(event.message);
          const next = statusToStage(event.message, hasAction);
          advanceStage(next);
        } else if (event.type === 'action' && 'action' in event && typeof event.action === 'string') {
          hasAction = true;
          const actionEvent = event as { type: 'action'; action: string; target?: string };
          const target = actionEvent.target ? ` ${actionEvent.target}` : '';
          const entry = `${actionEvent.action}${target}`;
          setLog((previous) => [...previous, entry]);
          setStatus(`Running ${entry}`);
          advanceStage(/^replay\s+/i.test(actionEvent.action) ? 'Replaying' : 'Executing');
        } else if (event.type === 'observation' && 'screenshot' in event && typeof event.screenshot === 'string') {
          setPreview(event.screenshot);
        } else if (event.type === 'done' && 'report' in event) {
          const completedReport = event.report as RunReport;
          setReport(completedReport);
          if (completedReport.designReview?.verdict === 'ai-slop-design') setSlopShowcase('stamp');
          setScreenshot(
            'screenshot' in event && typeof event.screenshot === 'string' ? event.screenshot : '',
          );
          setHighlight('highlight' in event && event.highlight && typeof event.highlight === 'object'
            ? event.highlight as { x: number; y: number; width: number; height: number }
            : undefined);
          setStatus('Complete');
          setActiveStage('Report');
          setCompletedStages((prev) => {
            const updated = new Set(prev);
            for (const s of ALL_STAGES.slice(1, -1)) updated.add(s);
            return updated;
          });
        } else if (event.type === 'error' && 'message' in event && typeof event.message === 'string') {
          setStatus(event.message);
        }
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Run failed');
    } finally {
      setRunning(false);
      if (activeStage === 'Idle') setActiveStage('Idle');
    }
  }

  const activeIndex = stageIndex(activeStage);
  const progressPct = Math.round(((activeIndex) / (ALL_STAGES.length - 1)) * 100);
  const narrative = describeLiveEvaluation({ mode: reviewType, url, status, log });

  return (
    <div className="app-layout">
      {running && (
        <div className="slop-loading eval-theater" role="dialog" aria-modal="false" aria-label="Live evaluation preview">
          <div className="eval-theater-shell">
            <div className="eval-theater-head">
              <div className="eval-theater-title">
                <span className="slop-loading-mark" aria-hidden="true">GQ</span>
                <div>
                  <span className="eval-stage-pill">{activeStage} · {status}</span>
                  <strong>{narrative.headline}</strong>
                </div>
              </div>
              <span className="eval-action-chip">{narrative.actionTag}</span>
            </div>

            <ol className="eval-stepper" aria-label="Evaluation stage progress">
              {ALL_STAGES.slice(1).map((stage, idx) => {
                const isCurrent = stage === activeStage;
                const isDone = completedStages.has(stage) && !isCurrent;
                return (
                  <li key={stage} className={`eval-step ${isCurrent ? 'active' : isDone ? 'done' : ''}`}>
                    <span className="eval-step-num" aria-hidden="true">{isDone ? '✓' : idx + 1}</span>
                    <span className="eval-step-name">{stage}</span>
                  </li>
                );
              })}
            </ol>

            <div className="eval-theater-body">
              <div className="eval-browser-frame">
                <div className="eval-browser-bar" aria-hidden="true">
                  <span className="eval-dots"><i /><i /><i /></span>
                  <code className="eval-address">{url}</code>
                  <span className="eval-live-badge">● LIVE CHROMIUM</span>
                </div>
                <div className="eval-viewport">
                  {preview ? (
                    <img src={preview} alt="Live page being evaluated" />
                  ) : (
                    <div className="eval-viewport-placeholder">
                      <span className="loading-spinner" aria-hidden="true" />
                      <span>Waiting for initial masked viewport frame…</span>
                    </div>
                  )}
                  <div className="eval-scan-beam" aria-hidden="true" />
                  <div className="eval-target-hud">
                    <span>Active target</span>
                    <strong>{narrative.where}</strong>
                  </div>
                </div>
              </div>

              <div className="eval-narrative-panel">
                <div className="eval-card">
                  <span className="eval-card-label">Where on the website</span>
                  <p>{narrative.where}</p>
                </div>
                <div className="eval-card">
                  <span className="eval-card-label">What GhostQA is evaluating</span>
                  <p>{narrative.what}</p>
                </div>
                <div className="eval-card eval-trace-live">
                  <span className="eval-card-label">Live action stream ({log.length}/10 budget)</span>
                  {log.length > 0 ? (
                    <ol>
                      {log.slice(-5).map((entry, idx) => (
                        <li key={`${idx}-${entry}`} className={idx === log.slice(-5).length - 1 ? 'current' : ''}>
                          <code>{entry}</code>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">Preparing initial navigation…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {slopShowcase !== 'off' && preview && <div className={`slop-showcase ${slopShowcase === 'settling' ? 'settling' : ''}`} aria-hidden="true" onTransitionEnd={(event) => { if (event.target === event.currentTarget && slopShowcase === 'settling') setSlopShowcase('off'); }}><div className="slop-showcase-frame"><img src={preview} alt="" /><span className="slop-stamp" onAnimationEnd={() => { setShowSlopStory(true); setSlopShowcase('settling'); }}>AI SLOP</span></div></div>}
      {/* ─── Top header ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">G<span>Q</span></div>
        <div className="brand-copy">
          <h1>GhostQA</h1>
          <span>Local website testing</span>
        </div>
      </header>

      {/* ─── Mobile progress strip ──────────────────────────────────── */}
      <div className="mobile-progress" role="status" aria-label="Run progress">
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="progress-label">{activeStage}</div>
      </div>

      {/* ─── Sidebar ────────────────────────────────────────────────── */}
      <aside className="sidebar" aria-label="Run progress">
        <div className="sidebar-overview">
          <div className="sidebar-title">Current run</div>
          <strong>{activeStage === 'Idle' ? 'Ready to test' : activeStage}</strong>
          <span>{activeIndex} of {ALL_STAGES.length - 1} stages</span>
          <div className="progress-bar-wrap" aria-hidden="true">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="sidebar-title">Run stages</div>
        <div>
          <ul className="sidebar-stages" role="list">
            {ALL_STAGES.map((stage) => {
              const isActive = stage === activeStage;
              const isCompleted = completedStages.has(stage);
              let stateLabel = '';
              if (isActive) stateLabel = ' (current)';
              else if (isCompleted) stateLabel = ' (done)';
              return (
                <li
                  key={stage}
                  className={`sidebar-stage ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${stage}${stateLabel}`}
                >
                  <span className="stage-indicator" aria-hidden="true">
                    <HugeiconsIcon
                      icon={isCompleted ? Tick02Icon : isActive ? RecordIcon : RadioIcon}
                      size={13}
                      strokeWidth={2.5}
                    />
                  </span>
                  <span className="stage-label">{stage}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="sidebar-note">One site · One bounded run</div>
      </aside>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <main className="main-content" id="main-content">
        <div className="shell">
          {!showWorkspace ? (
            <section className="panel content-hero" aria-label="GhostQA overview">
              <div className="hero-showcase">
                <div className="hero-left-col">
                  <section className="tagline-stack" aria-label="Problem and solution tagline">
                    <div className="tagline-card tagline-problem">
                      <span className="tagline-kicker">THE PROBLEM</span>
                      <p className="landing-problem-lead">
                        <strong>
                          AI-generated websites are everywhere — but are you sure yours actually works?
                        </strong>
                      </p>
                      <p>
                        Surface demos pass a quick glance while sign-up forms return <code>HTTP 500</code> and generic AI-slop layouts ship unmeasured.
                      </p>
                    </div>
                    <div className="tagline-card tagline-solution">
                      <span className="tagline-kicker">THE SOLUTION</span>
                      <p>
                        <strong>
                          GhostQA runs guarded Chromium checks and rendered-design audits to deliver replay-verified evidence, not guesswork.
                        </strong>{' '}
                        Every finding is backed by a masked screenshot, deterministic replay from a fresh context, or measured computed styles.
                      </p>
                    </div>
                  </section>
                  <div className="hero-cta-row">
                    <button type="button" className="hero-workspace-cta" onClick={goToWorkspace}>
                      Go to test workspace
                    </button>
                    <span className="muted">One bounded Chromium session · 10 actions max</span>
                  </div>
                </div>

                <section
                  className="design-demo-card"
                  aria-label="Animated design and workflow verification demo"
                >
                  <div className="demo-chrome-bar" aria-hidden="true">
                    <span className="eval-dots"><i /><i /><i /></span>
                    <code className="demo-chrome-url">http://127.0.0.1:3001/register</code>
                    <span className="demo-state-pill">● LIVE WEB PREVIEW</span>
                  </div>
                  <div className="demo-stage-canvas">
                    <div className="demo-site-canvas" aria-hidden="true">
                      <div className="demo-site-nav" data-testid="demo-web-navbar">
                        <span className="demo-site-brand">
                          <i className="demo-brand-dot" />
                          AcmeCloud
                        </span>
                        <div className="demo-site-links">
                          <span>Features</span>
                          <span>Pricing</span>
                          <span className="active">Sign up</span>
                        </div>
                      </div>

                      <div className="demo-web-hero" data-testid="demo-web-hero">
                        <div className="demo-web-hero-copy">
                          <span className="demo-web-pill">NEW RELEASE</span>
                          <div className="demo-web-h1">Ship faster with AI</div>
                          <div className="demo-web-line w-90" />
                          <div className="demo-web-line w-70" />
                          <div className="demo-verdict-row">
                            <span className="demo-badge-alert">500 REPLAY VERIFIED</span>
                            <span className="demo-badge-ok">CSS MEASURED</span>
                          </div>
                        </div>

                        <div className="demo-mock-form">
                          <div className="demo-mock-input demo-target-email">
                            <span>Email</span>
                            <code>alex@demo.local</code>
                          </div>
                          <div className="demo-mock-input masked demo-target-password">
                            <span>Pass</span>
                            <code>••••••••</code>
                          </div>
                          <div className="demo-mock-cta demo-target-submit">
                            Create account → 500
                          </div>
                        </div>
                      </div>

                      <div className="demo-web-cards" data-testid="demo-web-cards">
                        <div className="demo-web-card demo-card-1">
                          <div className="demo-card-head">
                            <span className="demo-card-icon" />
                            <span className="demo-card-tag">gap: 16px</span>
                          </div>
                          <div className="demo-web-line w-80" />
                          <div className="demo-web-line w-60" />
                        </div>
                        <div className="demo-web-card demo-card-2">
                          <div className="demo-card-head">
                            <span className="demo-card-icon" />
                            <span className="demo-card-tag">radius: 14px</span>
                          </div>
                          <div className="demo-web-line w-85" />
                          <div className="demo-web-line w-65" />
                        </div>
                        <div className="demo-web-card demo-card-3">
                          <div className="demo-card-head">
                            <span className="demo-card-icon" />
                            <span className="demo-card-tag">contrast: AA</span>
                          </div>
                          <div className="demo-web-line w-75" />
                          <div className="demo-web-line w-55" />
                        </div>
                      </div>

                      <div
                        className="demo-agent-cursor"
                        data-testid="demo-agent-cursor"
                      >
                        <span className="demo-cursor-ripple" />
                        <svg
                          className="demo-cursor-arrow"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                        >
                          <path
                            d="M4 3L11.5 20L14.2 13.2L21 10.5L4 3Z"
                            fill="#14b8a6"
                            stroke="#0f0f12"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="demo-cursor-tag">GhostQA</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          ) : (
            <>
              <div id="test-workspace" ref={workspaceRef} className="workspace-intro">
                <div className="workspace-intro-head">
                  <div>
                    <div className="eyebrow">TEST CONSOLE</div>
                    <h2>Test workspace</h2>
                    <p>Run a focused check and follow each browser action as it happens.</p>
                  </div>
                  <span className="workspace-limit">One site · 10 actions max</span>
                </div>
              </div>
              <div className="workspace-grid">
                {/* ─── Start a run ──────────────────────────────────────── */}
                <section className="panel run-panel" aria-labelledby="run-title">
                  <h2 id="run-title">Start a run</h2>
                  <form onSubmit={start}>
                    <label htmlFor="review-type">Review type</label>
                    <select id="review-type" value={reviewType} onChange={(event) => {
                      const next = event.target.value as 'test' | 'slop';
                      if (!liveMode && url === `${demoOrigin}/${reviewType === 'test' ? 'register' : 'slop'}`) setUrl(`${demoOrigin}/${next === 'test' ? 'register' : 'slop'}`);
                      setReviewType(next);
                    }} disabled={running}>
                      <option value="test">Functional test</option>
                      <option value="slop">AI slop design and code review</option>
                    </select>
                    <label htmlFor="url">{liveMode ? 'Website URL' : 'Local demo URL'}</label>
                    <input
                      ref={urlInputRef}
                      id="url"
                      type="url"
                      required
                      value={url}
                      placeholder={
                        liveMode ? 'https://example.com' : `${demoOrigin}/${reviewType === 'slop' ? 'slop' : 'register'}`
                      }
                      onChange={(event) => setUrl(event.target.value)}
                      disabled={running}
                    />
                    {reviewType === 'test' && <>
                      <label htmlFor="goal">
                        Goal <span className="muted">(optional)</span>
                      </label>
                      <input
                        id="goal"
                        value={goal}
                        placeholder={
                          liveMode ? 'e.g. Find any broken links or CSS issues' : 'Try registering'
                        }
                        onChange={(event) => setGoal(event.target.value)}
                        disabled={running}
                      />
                      <div className="goal-presets" role="group" aria-label="Common functional test goals">
                        <span className="goal-presets-label">Suggested goals:</span>
                        {COMMON_TEST_GOALS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className={`goal-chip ${goal === preset.goal ? 'active' : ''}`}
                            onClick={() => setGoal(preset.goal)}
                            disabled={running}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </>}
                    <button type="submit" disabled={running}>
                      {running ? 'Running…' : 'Start test'}
                    </button>
                  </form>
                  {liveMode ? (
                    <p className="hint">
                      Enter a public URL. Private and internal addresses are blocked; review stays on one origin.
                    </p>
                  ) : (
                    <p className="hint">
                      Fixture: <code>{demoOrigin}/register</code>, <code>/health</code>, or <code>/slop</code>. Use
                      synthetic data only.
                    </p>
                  )}
                </section>

                {/* ─── Run trace ────────────────────────────────────────── */}
                <section
                  className={`panel trace-panel ${activeStage === 'Observing' ? 'observing' : ''}`}
                  aria-labelledby="trace-title"
                >
                  <div className="section-head">
                    <h2 id="trace-title">Run trace</h2>
                    <span
                      role="status"
                      aria-live="polite"
                      className={`run-status ${running && isAnimatingStage(activeStage) ? '' : running ? '' : activeStage === 'Report' ? 'complete' : 'idle'}`}
                    >
                      <span>{status}</span>
                      {running && <span className="loading-spinner" aria-hidden="true" />}
                    </span>
                  </div>
                  {log.length > 0 ? (
                    <ol aria-live="polite" aria-label="Action log">
                      {log.map((entry, index) => (
                        <li key={`${index}-${entry}`}>{entry}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">Actions will appear here as they run.</p>
                  )}
                </section>
              </div>

              {preview && !running && (
                <section ref={observationRef} tabIndex={-1} className={`panel ${reviewType === 'slop' ? 'slop-observation' : ''}`} aria-label="Live page observation">
                  <div className="section-head">
                    <h2>Page observation</h2>
                    <span className="muted">{running ? 'Updating during validation' : 'Last observed page'}</span>
                  </div>
                  <div className="slop-preview">
                    <img className="observation-image" src={preview} alt="Latest masked browser observation" />
                    {report?.designReview?.verdict === 'ai-slop-design' && <span className="slop-stamp" aria-label="AI slop by design">AI SLOP</span>}
                  </div>
                </section>
              )}

              {/* ─── Result ───────────────────────────────────────────── */}
              {report && (report.designReview?.verdict !== 'ai-slop-design' || showSlopStory) && (
                <section className="panel" aria-labelledby="result-title">
                  <div className="section-head">
                    <h2 id="result-title">Result</h2>
                    <strong className={`outcome ${report.status}`}>{report.status}</strong>
                  </div>

                  {report.designReview ? (
                    <SlopReviewStory review={report.designReview} />
                  ) : report.finding ? (
                    <FindingCard finding={report.finding} screenshot={screenshot} highlight={highlight} />
                  ) : (
                    <NoFindingState
                      status={report.status as 'no-finding' | 'inconclusive'}
                      reason={report.markdown}
                      suggestions={report.suggestions ?? []}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
