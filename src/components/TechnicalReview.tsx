import type { TechnicalReview as TechnicalReviewData } from '../lib/technical-review';

export function TechnicalReview({ review }: { review: TechnicalReviewData }) {
  return <div className="slop-story">
    <h3>Technical observations</h3>
    <p>{review.coverage}</p>
    <p>{review.metrics.resources} responses · {review.metrics.transferKB} KB declared transfer · {review.metrics.loadMs} ms load event</p>
    {review.findings.length ? <ol aria-label="Technical observations">{review.findings.map((finding) => <li key={finding.id}>
      <span className="slop-category">{finding.category}</span>
      <h4>{finding.title}</h4>
      <p>{finding.detail}</p>
      <p><strong>Next check</strong> {finding.next}</p>
    </li>)}</ol> : <p>No signals matched in the captured page. Limited coverage does not establish that the site is secure.</p>}
  </div>;
}
