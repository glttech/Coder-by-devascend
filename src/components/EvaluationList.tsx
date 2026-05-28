import { Evaluation } from '@prisma/client';

interface Props {
  evaluations: Evaluation[];
}

/**
 * Render a list of evaluation results.  Each evaluation shows whether the
 * check passed and, if not, the reason.  The component expects to receive
 * evaluations attached to an agent run via Prisma relations.
 */
export default function EvaluationList({ evaluations }: Props) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
        Evaluations
      </div>
      {evaluations.map((ev) => (
        <div key={ev.id} className="eval-item">
          <span className={`eval-dot ${ev.passed ? 'eval-dot-pass' : 'eval-dot-fail'}`} />
          <div>
            <span className="eval-name">{ev.name}</span>
            {' '}
            <span style={{ fontSize: 11, color: ev.passed ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }}>
              {ev.passed ? 'Pass' : 'Fail'}
            </span>
            {ev.reason && <div className="eval-reason">{ev.reason}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}