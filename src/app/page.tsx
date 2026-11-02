'use client';

import { useState, type FormEvent } from 'react';
import type { RunReport } from '../lib/report';
import { readRunEvents } from '../lib/run-events';
import { FindingCard } from '../components/FindingCard';
import { NoFindingState } from '../components/NoFindingState';
import './style.css';

const liveMode = process.env.NEXT_PUBLIC_ALLOW_LIVE_SITES === 'true';
const modelMode = process.env.NEXT_PUBLIC_MODEL_MODE ?? 'mock';

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
  const [url, setUrl] = useState(liveMode ? '' : 'http://127.0.0.1:3001/register');
  const [goal, setGoal] = useState(liveMode ? '' : 'Try registering');
  const [status, setStatus] = useState('Ready');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const [screenshot, setScreenshot] = useState('');
  const [activeStage, setActiveStage] = useState<Stage>('Idle');
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());

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
    setActiveStage('Validating URL');
    setCompletedStages(new Set());

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, goal }),
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
        } else if (event.type === 'done' && 'report' in event) {
          setReport(event.report as RunReport);
          setScreenshot(
            'screenshot' in event && typeof event.screenshot === 'string' ? event.screenshot : '',
          );
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
      {/* ─── Top header ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div>
          <div className="eyebrow">LOCAL DEMO QA</div>
          <h1>GhostQA</h1>
        </div>
        <span className="mode">
          {liveMode && modelMode === 'meta'
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
      <aside className="sidebar">
        <div className="sidebar-title">Run stages</div>
        <nav aria-label="Run stages">
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
        </nav>
      </aside>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <main className="main-content" id="main-content">
        <div className="shell">
          {/* ─── Start a run ──────────────────────────────────────── */}
          <section className="panel" aria-labelledby="run-title">
            <h2 id="run-title">Start a run</h2>
            <form onSubmit={start}>
              <label htmlFor="url">{liveMode ? 'Website URL' : 'Local demo URL'}</label>
              <input
                id="url"
                type="url"
                required
                value={url}
                placeholder={
                  liveMode ? 'https://example.com' : 'http://127.0.0.1:3001/register'
                }
                onChange={(event) => setUrl(event.target.value)}
                disabled={running}
              />
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
              <button type="submit" disabled={running}>
                {running ? 'Running…' : 'Start test'}
              </button>
            </form>
            {liveMode ? (
              <p className="hint">
                Enter any public URL. Private and internal addresses are blocked.
              </p>
            ) : (
              <p className="hint">
                Fixture: <code>http://127.0.0.1:3001/register</code> or <code>/health</code>. Use
                synthetic data only.
              </p>
            )}
          </section>

          {/* ─── Run trace ────────────────────────────────────────── */}
          <section
            className={`panel ${activeStage === 'Observing' ? 'observing' : ''}`}
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
                {running && <span className="animated-ellipsis" aria-hidden="true" />}
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

          {/* ─── Result ───────────────────────────────────────────── */}
          {report && (
            <section className="panel" aria-labelledby="result-title">
              <div className="section-head">
                <h2 id="result-title">Result</h2>
                <strong className={`outcome ${report.status}`}>{report.status}</strong>
              </div>

              {report.finding ? (
                <FindingCard finding={report.finding} screenshot={screenshot} />
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
