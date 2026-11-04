import Link from 'next/link';
import './landing.css';

export default function LandingPage() {
  return (
    <main className="entry-page">
      <header className="entry-nav">
        <Link className="entry-brand" href="/" aria-label="GhostQA home"><img src="/ghostqa-mark.svg" alt="" width="38" height="38" />GhostQA</Link>
        <div className="entry-nav-steps" aria-hidden="true"><span>Observe</span><span>Verify</span><span>Report</span></div>
        <Link className="entry-nav-cta" href="/dashboard">Open dashboard <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M5 19 19 5M7 5h12v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
      </header>

      <section className="entry-hero" aria-labelledby="entry-title">
        <h1 id="entry-title">Find what your<br />website <span className="entry-globe" aria-hidden="true"><span /></span> hides.</h1>
        <div className="entry-hero-note">
          <div className="entry-note-lead"><p>Real browser checks.<br /><strong>Replay-backed evidence.</strong></p></div>
          <a className="entry-hackathon" href="https://cerebralvalley.ai/e/meta-ai-developer-hackathon/" target="_blank" rel="noopener noreferrer">My official entry for the<br />Meta Global AI Developer Hackathon <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="entry-website" aria-label="Illustration of a GhostQA website review">
        <div className="entry-site-nav"><span className="entry-site-logo">AcmeCloud<span>.</span></span><span>Product&nbsp;&nbsp;&nbsp; About&nbsp;&nbsp;&nbsp; Sign in</span></div>
        <div className="entry-site-content">
          <div className="entry-site-copy"><small>WELCOME ABOARD</small><h2>Start something<br />remarkable.</h2><p>Build your account in just a few steps.</p><span className="entry-site-button">Create account ↗</span></div>
          <div className="entry-form"><span>YOUR EMAIL</span><div>you@example.com</div><span>PASSWORD</span><div>••••••••••••</div><b>Create account →</b><small>Something went wrong. Please try again.</small></div>
        </div>
        <div className="entry-scan" aria-hidden="true"><span>+</span></div>
        <div className="entry-result"><span className="entry-result-icon">!</span><div><small>REPLAY CONFIRMED</small><strong>Registration did not complete</strong><span>Expected confirmation · Observed failure</span></div></div>
        <Link className="entry-demo-cta" href="/dashboard"><span>Try GhostQA</span></Link>
      </section>
      <div className="entry-fade" aria-hidden="true" />
    </main>
  );
}
