'use client';

interface NoFindingStateProps {
  status: 'no-finding' | 'inconclusive';
  suggestions: string[];
}

export function NoFindingState({ status, suggestions }: NoFindingStateProps) {
  const isNoFinding = status === 'no-finding';

  return (
    <div className="no-finding-state" role="region" aria-label={isNoFinding ? 'No issues found' : 'Inconclusive result'}>
      <div className="no-finding-icon" aria-hidden="true">
        <svg
          className="shield-icon"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={isNoFinding ? 'Shield checkmark icon' : 'Shield icon'}
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

      <div className="suggestions-card" aria-label="Improvement suggestions">
        <div className="suggestions-header">
          <span className="suggestions-label">Improvement suggestions</span>
        </div>
        {suggestions.length > 0 ? (
          <ul className="suggestions-list" aria-label="List of improvement suggestions">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <span aria-hidden="true">💡</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No suggestions available — try again with a live Meta model connection.
          </p>
        )}
      </div>
    </div>
  );
}
