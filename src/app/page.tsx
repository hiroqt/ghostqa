'use client';

import { useState, type FormEvent } from 'react';
import type { RunReport } from '../lib/report';
import { readRunEvents } from '../lib/run-events';
import './style.css';

const liveMode = process.env.NEXT_PUBLIC_ALLOW_LIVE_SITES === 'true';
const modelMode = process.env.NEXT_PUBLIC_MODEL_MODE ?? 'mock';

export default function Home() {
  const [url, setUrl] = useState(liveMode ? '' : 'http://127.0.0.1:3001/register');
  const [goal, setGoal] = useState(liveMode ? '' : 'Try registering');
  const [status, setStatus] = useState('Ready');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const [screenshot, setScreenshot] = useState('');

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunning(true);
    setStatus('Starting');
    setLog([]);
    setReport(null);
    setScreenshot('');
    try {
      const response = await fetch('/api/runs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, goal }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Run rejected');
      }
      if (!response.body) throw new Error('Run stream unavailable');
      await readRunEvents(response.body, (event) => {
        if (!event || typeof event !== 'object' || !('type' in event)) return;
        if (event.type === 'status' && 'message' in event && typeof event.message === 'string') {
          setStatus(event.message);
        } else if (event.type === 'action' && 'action' in event && typeof event.action === 'string') {
          const target = 'target' in event && typeof event.target === 'string' ? ` ${event.target}` : '';
          setLog((previous) => [...previous, `${event.action}${target}`]);
        } else if (event.type === 'done' && 'report' in event) {
          setReport(event.report as RunReport);
          setScreenshot('screenshot' in event && typeof event.screenshot === 'string' ? event.screenshot : '');
          setStatus('Complete');
        } else if (event.type === 'error' && 'message' in event && typeof event.message === 'string') {
          setStatus(event.message);
        }
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  return <main className="shell">
    <header className="header">
      <div className="eyebrow">LOCAL DEMO QA</div>
      <h1>GhostQA</h1>
      <p>One guarded browser run. One evidence-backed finding, or an honest inconclusive result.</p>
      <span className="mode">
        {liveMode && modelMode === 'meta'
          ? 'Live mode · Meta Model API (Muse Spark)'
          : liveMode
            ? 'Live mode · mock reasoning'
            : modelMode === 'meta'
              ? 'Local demo · Meta Model API (Muse Spark)'
              : 'Deterministic mock mode · live Meta integration unverified'}
      </span>
    </header>

    <section className="panel" aria-labelledby="run-title">
      <h2 id="run-title">Start a run</h2>
      <form onSubmit={start}>
        <label htmlFor="url">{liveMode ? 'Website URL' : 'Local demo URL'}</label>
        <input
          id="url" type="url" required value={url}
          placeholder={liveMode ? 'https://example.com' : 'http://127.0.0.1:3001/register'}
          onChange={(event) => setUrl(event.target.value)} disabled={running}
        />
        <label htmlFor="goal">Goal <span className="muted">(optional)</span></label>
        <input
          id="goal" value={goal}
          placeholder={liveMode ? 'e.g. Find any broken links or CSS issues' : 'Try registering'}
          onChange={(event) => setGoal(event.target.value)} disabled={running}
        />
        <button type="submit" disabled={running}>{running ? 'Running…' : 'Start test'}</button>
      </form>
      {liveMode
        ? <p className="hint">Enter any public URL. Private and internal addresses are blocked.</p>
        : <p className="hint">Fixture: <code>http://127.0.0.1:3001/register</code> or <code>/health</code>. Use synthetic data only.</p>}
    </section>

    <section className="panel" aria-labelledby="trace-title">
      <div className="section-head"><h2 id="trace-title">Run trace</h2><span role="status">{status}</span></div>
      {log.length ? <ol aria-live="polite">{log.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol> : <p className="muted">Actions will appear here as they run.</p>}
    </section>

    {report && <section className="panel" aria-labelledby="result-title">
      <div className="section-head"><h2 id="result-title">Result</h2><strong className={`outcome ${report.status}`}>{report.status}</strong></div>
      {report.finding ? <>
        <dl><dt>Expected</dt><dd>{report.finding.expected}</dd><dt>Actual</dt><dd>{report.finding.actual}</dd></dl>
        {screenshot && <img className="evidence" src={screenshot} alt="Masked browser screenshot of the verified failure" />}
        <h3>HTTP evidence</h3><ul>{report.finding.httpFailures.map((item, index) => <li key={index}>{item.status} {item.url}</li>)}</ul>
        <h3>Console evidence</h3><p>{report.finding.consoleErrors.join('; ') || 'No console errors recorded'}</p>
        <h3>Replay steps</h3>
        <ol>{report.finding.replaySteps.map((action, index) => <li key={index}>
          {action.type} {action.target ?? (action.type === 'navigate' ? action.value : '')}
        </li>)}</ol>
        <h3>Playwright reproduction</h3><pre><code>{report.finding.reproductionTest}</code></pre>
      </> : <p>{report.markdown}</p>}
    </section>}
  </main>;
}
