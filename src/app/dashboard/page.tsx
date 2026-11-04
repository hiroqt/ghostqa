'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import RadioIcon from '@hugeicons/core-free-icons/RadioIcon';
import RecordIcon from '@hugeicons/core-free-icons/RecordIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import type { RunReport } from '../../lib/report';
import { COMMON_TEST_GOALS } from '../../lib/contracts';
import { describeLiveEvaluation, readRunEvents } from '../../lib/run-events';
import { FindingCard } from '../../components/FindingCard';
import { NoFindingState } from '../../components/NoFindingState';
import { SlopReviewStory } from '../../components/SlopReviewStory';
import { TechnicalReview } from '../../components/TechnicalReview';
import { LandingShowcase } from '../../components/LandingShowcase';
import '../style.css';
import '../interactive.css';

const liveMode = process.env.NEXT_PUBLIC_ALLOW_LIVE_SITES === 'true';

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
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState(liveMode ? '' : 'Try registering');
  const [reviewType, setReviewType] = useState<'test' | 'slop' | 'technical'>('test');
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {running && (
        <div className="slop-loading eval-theater" role="dialog" aria-modal="false" aria-label="Live evaluation preview">
          <div className="eval-theater-shell">
            <div className="eval-theater-head">
              <div className="eval-theater-title">
                <span className="slop-loading-mark" aria-hidden="true">GQ</span>
                <div>
                  <span className="eval-stage-text">{activeStage} — {status}</span>
                  <strong>{narrative.headline}</strong>
                </div>
              </div>
              <code className="eval-action-text">{narrative.actionTag}</code>
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
        <img className="brand-mark" src="/ghostqa-mark.svg" alt="" />
        <div className="brand-copy">
          <h1>GhostQA</h1>
          <span>Website quality testing</span>
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
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} aria-label="Run progress">
        <nav className="sidebar-nav" aria-label="Primary">
          <button type="button" className="sidebar-nav-item" aria-current={!showWorkspace ? 'page' : undefined} onClick={() => setShowWorkspace(false)} disabled={running} title="Overview">
            <span className="nav-glyph" aria-hidden="true">◐</span><span className="nav-label">Overview</span>
          </button>
          <button type="button" className="sidebar-nav-item" aria-current={showWorkspace ? 'page' : undefined} onClick={goToWorkspace} title="Workspace">
            <span className="nav-glyph" aria-hidden="true">▣</span><span className="nav-label">Workspace</span>
          </button>
        </nav>
        <div className="sidebar-overview">
          <span className="sidebar-caption">Current run</span>
          <strong>{activeStage === 'Idle' ? 'Ready to test' : activeStage}</strong>
          <div className="progress-bar-wrap" aria-hidden="true">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="sidebar-meters">
            <span>Stage <b>{activeIndex}/{ALL_STAGES.length - 1}</b></span>
            <span>Actions <b>{log.length}/10</b></span>
          </div>
        </div>
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
                  title={stage}
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
        <button
          type="button"
          className="sidebar-collapse"
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed((c) => !c)}
        >
          <span aria-hidden="true">{sidebarCollapsed ? '»' : '«'}</span>
          <span className="nav-label">Collapse</span>
        </button>
      </aside>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <main className="main-content" id="main-content">
        <div className="shell">
          {!showWorkspace ? (
            <LandingShowcase onStart={goToWorkspace} />
          ) : (
            <>
              <div id="test-workspace" ref={workspaceRef} className="workspace-intro">
                <div className="workspace-intro-head">
                  <div>
                    <h2>Test workspace</h2>
                    <p>Point GhostQA at one page, give it a goal, and watch each browser action as it happens.</p>
                  </div>
                </div>
              </div>
              <div className="workspace-grid">
                {/* ─── Start a run ──────────────────────────────────────── */}
                <section className="panel run-panel" aria-labelledby="run-title">
                  <h2 id="run-title">Start a run</h2>
                  <form onSubmit={start}>
                    <label htmlFor="review-type">Review type</label>
                    <select id="review-type" value={reviewType} onChange={(event) => setReviewType(event.target.value as 'test' | 'slop' | 'technical')} disabled={running}>
                      <option value="test">Functional test</option>
                      <option value="slop">AI slop design and code review</option>
                      <option value="technical">Technical security and performance review</option>
                    </select>
                    <label htmlFor="url">Website URL</label>
                    <input
                      ref={urlInputRef}
                      id="url"
                      type="url"
                      required
                      value={url}
                      placeholder="Enter website URL"
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
                      Public pages are available for read-only reviews. Requests stay on one origin.
                    </p>
                  ) : (
                    <p className="hint">
                      Enter the website URL enabled for functional testing. Use synthetic data only.
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

                  {report.technicalReview ? (
                    <TechnicalReview review={report.technicalReview} />
                  ) : report.designReview ? (
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
