'use client';

import { useEffect, useState } from 'react';

type Mode = 'problem' | 'solution';

const CYCLE_MS = 9000;

const STEPS: Record<Mode, Array<{ label: string; detail: string }>> = {
  problem: [
    { label: 'Fill email', detail: 'Visitor enters alex@demo.local' },
    { label: 'Fill password', detail: 'Password field accepts input' },
    { label: 'Press “Create account”', detail: 'Form submits POST /api/register' },
    { label: 'Spinner… then nothing', detail: 'Server returns 500; UI stays stuck' },
  ],
  solution: [
    { label: 'Navigate /register', detail: 'Guarded Chromium loads allowlisted URL' },
    { label: 'Fill synthetic data', detail: 'Credentials masked in screenshots & logs' },
    { label: 'Catch HTTP 500', detail: 'Captures status 500 + DOM outcome' },
    { label: 'Replay in fresh context', detail: 'Confirms failure deterministically' },
  ],
};

const CARD_METRICS = [
  { label: 'Sync engine', metric: 'gap 16px' },
  { label: 'Edge cache', metric: 'radius 14px' },
  { label: 'Audit log', metric: 'contrast AA' },
];

export function LandingShowcase({ onStart }: { onStart: () => void }) {
  const [mode, setMode] = useState<Mode>('problem');
  const [auto, setAuto] = useState(true);
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);

  useEffect(() => {
    if (!auto || pinnedStep !== null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setMode((m) => (m === 'problem' ? 'solution' : 'problem')), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [auto, pinnedStep]);

  function pickMode(next: Mode) {
    setAuto(false);
    setPinnedStep(null);
    setMode(next);
  }

  function handleStepClick(index: number) {
    setAuto(false);
    setPinnedStep((current) => (current === index ? null : index));
  }

  return (
    <section className="panel content-hero landing" aria-label="GhostQA overview">
      <div className="landing-grid">
        <div className="landing-copy">
          <h2 className="landing-title">Your AI-built site looks done. Does it work?</h2>
          <section className="ps-switch" aria-label="Problem and solution tagline">
            <button
              type="button"
              className={`ps-option tagline-problem ${mode === 'problem' ? 'is-active' : ''}`}
              aria-pressed={mode === 'problem'}
              onClick={() => pickMode('problem')}
            >
              <span className="ps-option-head">
                <span className="ps-dot" aria-hidden="true" />
                <span>Watch what users hit</span>
                <span className="ps-option-meta">Unchecked ship</span>
              </span>
              <strong>AI-generated websites are everywhere — but are you sure yours actually works?</strong>
              <span className="ps-option-body">
                <span>
                  Surface demos pass a quick glance while sign-up forms quietly return <code>HTTP 500</code> and templated layouts ship unmeasured.
                </span>
              </span>
            </button>
            <button
              type="button"
              className={`ps-option tagline-solution ${mode === 'solution' ? 'is-active' : ''}`}
              aria-pressed={mode === 'solution'}
              onClick={() => pickMode('solution')}
            >
              <span className="ps-option-head">
                <span className="ps-dot" aria-hidden="true" />
                <span>See how GhostQA verifies it</span>
                <span className="ps-option-meta">Guarded replay</span>
              </span>
              <strong>GhostQA runs guarded Chromium checks and rendered-design audits to deliver replay-verified evidence, not guesswork.</strong>
              <span className="ps-option-body">
                <span>
                  Every finding is backed by a masked screenshot, network trace, and a deterministic replay from a fresh browser context.
                </span>
              </span>
            </button>
          </section>
          <div className="hero-cta-row">
            <button type="button" className="hero-workspace-cta" onClick={onStart}>
              Go to test workspace
            </button>
            <span className="muted">One bounded Chromium session · 10 actions max</span>
          </div>
        </div>

        <section
          className="design-demo-card"
          data-mode={mode}
          data-step={pinnedStep !== null ? String(pinnedStep) : undefined}
          aria-label="Animated design and workflow verification demo"
        >
          <div className="demo-chrome-bar">
            <span className="eval-dots" aria-hidden="true"><i /><i /><i /></span>
            <code className="demo-chrome-url">http://127.0.0.1:3001/register</code>
            <div className="demo-chrome-controls" role="group" aria-label="Simulation view">
              <button
                type="button"
                className={`demo-mode-btn ${mode === 'problem' ? 'active' : ''}`}
                onClick={() => pickMode('problem')}
              >
                Visitor
              </button>
              <button
                type="button"
                className={`demo-mode-btn ${mode === 'solution' ? 'active' : ''}`}
                onClick={() => pickMode('solution')}
              >
                GhostQA
              </button>
            </div>
          </div>

          {/* key restarts the CSS timeline whenever the mode flips */}
          <div className="demo-stage-canvas" key={mode} aria-hidden="true">
            <div className="demo-site-canvas">
              <div className="demo-site-nav" data-testid="demo-web-navbar">
                <span className="demo-site-brand"><i className="demo-brand-dot" />AcmeCloud</span>
                <div className="demo-site-links">
                  <span>Features</span>
                  <span>Pricing</span>
                  <span className="active">Sign up</span>
                </div>
              </div>

              <div className="demo-web-hero" data-testid="demo-web-hero">
                <div className="demo-web-hero-copy">
                  <div className="demo-web-h1">Ship faster with AI</div>
                  <div className="demo-web-line w-90" />
                  <div className="demo-web-line w-70" />
                  <div className="demo-inline-caption">
                    {mode === 'problem' ? 'Looks polished at first glance' : 'DOM, network & layout observed'}
                  </div>
                </div>
                <div className="demo-mock-form">
                  <div className="demo-mock-input demo-target-email">
                    <span>Email</span>
                    <code className="demo-type">alex@demo.local</code>
                  </div>
                  <div className="demo-mock-input masked demo-target-password">
                    <span>Pass</span>
                    <code className="demo-type">••••••••</code>
                  </div>
                  <div className="demo-mock-cta demo-target-submit">
                    <span className="cta-idle">Create account</span>
                    <span className="cta-busy"><i className="demo-spin" />Creating…</span>
                  </div>
                </div>
              </div>

              <div className="demo-web-cards" data-testid="demo-web-cards">
                {CARD_METRICS.map((item, i) => (
                  <div key={item.label} className={`demo-web-card demo-card-${i + 1}`}>
                    <div className="demo-card-top">
                      <span className="demo-card-icon" />
                      <span className="demo-card-title">{item.label}</span>
                    </div>
                    <div className="demo-web-line w-80" />
                    <div className="demo-web-line w-60" />
                    <span className="demo-card-measure">{item.metric}</span>
                  </div>
                ))}
              </div>

              {mode === 'problem' ? (
                <div className="demo-devtools">
                  <span>Network</span>
                  <code>POST /api/register</code>
                  <b>500 Internal Error</b>
                </div>
              ) : (
                <div className="demo-evidence" data-testid="demo-evidence">
                  <strong>Registration failed</strong>
                  <span>POST /api/register → 500</span>
                  <span className="demo-evidence-replay">Replayed once · verified</span>
                </div>
              )}

              <div className="demo-agent-cursor" data-testid="demo-agent-cursor">
                <span className="demo-cursor-ripple" />
                <svg className="demo-cursor-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M4 3L11.5 20L14.2 13.2L21 10.5L4 3Z" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
                <span className="demo-cursor-tag">{mode === 'problem' ? 'Visitor' : 'GhostQA'}</span>
              </div>
              {pinnedStep !== null && (
                <div className="demo-step-callout">
                  <strong>{STEPS[mode][pinnedStep].label}</strong>
                  <span>{STEPS[mode][pinnedStep].detail}</span>
                </div>
              )}
            </div>
          </div>

          <ol className="demo-steps" key={`steps-${mode}`} aria-label="Simulation timeline steps">
            {STEPS[mode].map((step, i) => (
              <li
                key={step.label}
                className={pinnedStep === i ? 'is-pinned' : ''}
                style={{ animationDelay: `${i * 2}s` }}
              >
                <button
                  type="button"
                  className="demo-step-btn"
                  aria-pressed={pinnedStep === i}
                  onClick={() => handleStepClick(i)}
                  title={step.detail}
                >
                  <span className="demo-step-num">{i + 1}</span>
                  <span className="demo-step-text">
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
