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
    <div className="border-t pt-2 mt-2">
      <h3 className="text-sm font-medium mb-1">Evaluations</h3>
      <ul className="space-y-1 text-sm">
        {evaluations.map((ev) => (
          <li key={ev.id} className={ev.passed ? 'text-green-700' : 'text-red-700'}>
            <span className="font-semibold">{ev.name}:</span> {ev.passed ? 'Pass' : 'Fail'}
            {ev.reason && <span className="ml-1 text-gray-700">— {ev.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}