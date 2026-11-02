'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RunReport } from '../lib/report';
import { readRunEvents } from '../lib/run-events';
import { FindingCard } from '../components/FindingCard';
import { NoFindingState } from '../components/NoFindingState';
import { SlopReviewStory } from '../components/SlopReviewStory';
import './style.css';

const liveMode = process.env.NEXT_PUBLIC_ALLOW_LIVE_SITES === 'true';
const modelMode = process.env.NEXT_PUBLIC_MODEL_MODE ?? 'mock';
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
  if (m.includes('observing page')) return 'Observing';
  if (m.includes('reasoning') || m.includes('deciding')) return 'Reasoning';
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
  const [showSlopStory, setShowSlopStory] = useState(false);
  const [slopShowcase, setSlopShowcase] = useState<'off' | 'stamp' | 'settling'>('off');
  const [highlight, setHighlight] = useState<{ x: number; y: number; width: number; height: number }>();
  const [activeStage, setActiveStage] = useState<Stage>('Idle');
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());

  useEffect(() => {
    if (report?.slopReview?.status === 'story' && (!preview || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      setShowSlopStory(true);
      setSlopShowcase('off');
    }
  }, [report, preview]);

  useEffect(() => {
    if (report?.slopReview && preview && slopShowcase === 'off') {
      observationRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      observationRef.current?.focus({ preventScroll: true });
    }
  }, [report, preview, slopShowcase]);

  function advanceStage(next: Stage) {
    setActiveStage((current) => {
      const ci = stageIndex(current);
      const ni = stageIndex(next);
      if (ni > ci) {
        // Mark everything between current (exclusive) and next (exclusive) as completed
        setCompletedStages((prev) => {
          const updated = new Set(prev);
          for (let i = 1; i < ni; i++) updated.add(ALL_STAGES[i]);
          return updated;
        });
      }
      return ni > ci ? next : current;
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
          setLog((previous) => [...previous, `${actionEvent.action}${target}`]);
          advanceStage('Executing');
        } else if (event.type === 'observation' && 'screenshot' in event && typeof event.screenshot === 'string') {
          setPreview(event.screenshot);
        } else if (event.type === 'done' && 'report' in event) {
          const completedReport = event.report as RunReport;
          setReport(completedReport);
          if (completedReport.slopReview?.status === 'story') setSlopShowcase('stamp');
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

  return (
    <div className="app-layout">
      {running && reviewType === 'slop' && <div className="slop-loading" role="status" aria-live="polite"><span className="slop-loading-mark" aria-hidden="true">GQ</span><strong>Analyzing page design</strong><span>{status}</span></div>}
      {slopShowcase !== 'off' && preview && <div className={`slop-showcase ${slopShowcase === 'settling' ? 'settling' : ''}`} aria-hidden="true" onTransitionEnd={(event) => { if (event.target === event.currentTarget && slopShowcase === 'settling') setSlopShowcase('off'); }}><div className="slop-showcase-frame"><img src={preview} alt="" /><span className="slop-stamp" onAnimationEnd={() => { setShowSlopStory(true); setSlopShowcase('settling'); }}>AI SLOP</span></div></div>}
      {/* ─── Top header ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">G<span>Q</span></div>
        <div className="brand-copy">
          <h1>GhostQA</h1>
          <span>Local website testing</span>
        </div>
        <span className="mode">
          {reviewType === 'slop'
            ? liveMode ? 'Live mode · source pattern review' : 'Local demo · source pattern review'
            : liveMode && modelMode === 'meta'
            ? 'Live mode · Meta Model API'
            : liveMode
              ? 'Live mode · mock reasoning'
              : modelMode === 'meta'
                ? 'Local demo · Meta Model API'
                : 'Deterministic mock mode'}
        </span>
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
                    {isCompleted ? '✓' : isActive ? '●' : '○'}
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
          <div className="workspace-intro">
            <div>
              <div className="eyebrow">TEST CONSOLE</div>
              <h2>Test workspace</h2>
              <p>Run a focused check and follow each browser action as it happens.</p>
            </div>
            <span className="workspace-limit">One site · 10 actions max</span>
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

          {preview && (!running || reviewType !== 'slop') && (
            <section ref={observationRef} tabIndex={-1} className={`panel ${reviewType === 'slop' ? 'slop-observation' : ''}`} aria-label="Live page observation">
              <div className="section-head">
                <h2>Page observation</h2>
                <span className="muted">{running ? 'Updating during validation' : 'Last observed page'}</span>
              </div>
              <div className="slop-preview">
                <img className="observation-image" src={preview} alt="Latest masked browser observation" />
                {report?.slopReview?.status === 'story' && <span className="slop-stamp" aria-label="AI slop pattern review">AI SLOP</span>}
              </div>
            </section>
          )}

          {/* ─── Result ───────────────────────────────────────────── */}
          {report && (report.slopReview?.status !== 'story' || showSlopStory) && (
            <section className="panel" aria-labelledby="result-title">
              <div className="section-head">
                <h2 id="result-title">Result</h2>
                <strong className={`outcome ${report.status}`}>{report.status}</strong>
              </div>

              {report.slopReview ? (
                <SlopReviewStory review={report.slopReview} />
              ) : report.finding ? (
                <FindingCard finding={report.finding} screenshot={screenshot} highlight={highlight} />
              ) : (
                <NoFindingState
                  status={report.status as 'no-finding' | 'inconclusive'}
                  suggestions={report.suggestions ?? []}
                />
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
