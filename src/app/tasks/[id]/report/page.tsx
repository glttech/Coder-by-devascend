import prisma from '@/lib/prisma';
import Link from 'next/link';
import { buildPrompt } from '@/lib/promptBuilder';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:            { background: '#f3f4f6', color: '#374151' },
  pending_approval: { background: '#fef3c7', color: '#92400e' },
  approved:         { background: '#dbeafe', color: '#1e40af' },
  executing:        { background: '#ede9fe', color: '#5b21b6' },
  completed:        { background: '#dcfce7', color: '#166534' },
  blocked:          { background: '#fee2e2', color: '#991b1b' },
};

const DECISION_STYLE: Record<string, React.CSSProperties> = {
  CONTINUE:                   { background: '#dcfce7', color: '#15803d' },
  RUN_VALIDATION:             { background: '#dbeafe', color: '#1d4ed8' },
  ASK_AGENT_FOR_EVIDENCE:     { background: '#fef9c3', color: '#a16207' },
  SENIOR_APPROVAL_REQUIRED:   { background: '#ede9fe', color: '#6d28d9' },
  BLOCKED:                    { background: '#fee2e2', color: '#b91c1c' },
};

function Badge({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <span style={{ ...style, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 16 }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

interface ReportPageProps {
  params: { id: string };
}

export default async function EvidenceReportPage({ params }: ReportPageProps) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      approval: true,
      instructions: { orderBy: { createdAt: 'desc' } },
      operatorSessions: { orderBy: { createdAt: 'desc' }, take: 5 },
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { instruction: { select: { id: true, title: true } } },
      },
      agentRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        include: { evaluations: true },
      },
    },
  });

  if (!task) {
    return <p className="text-red-600">Task not found.</p>;
  }

  const prompt = buildPrompt(task);
  const latestSession = task.operatorSessions[0] ?? null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{task.title}</h2>
          <p className="text-xs" style={{ color: '#6b7280', fontFamily: 'monospace' }}>{task.id}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge text={task.riskLevel} style={task.riskLevel === 'high' ? { background: '#fee2e2', color: '#b91c1c' } : task.riskLevel === 'medium' ? { background: '#fef9c3', color: '#a16207' } : { background: '#dcfce7', color: '#15803d' }} />
          <Badge text={task.environment} style={{ background: '#f3f4f6', color: '#374151' }} />
          <Link href={`/tasks/${task.id}`} className="text-blue-600 underline text-xs">← Task Detail</Link>
        </div>
      </div>

      {/* Task Summary */}
      <Section title="Task Summary">
        <div className="text-sm space-y-1">
          <div><span style={{ color: '#6b7280' }}>Instruction:</span> {task.instruction}</div>
          <div><span style={{ color: '#6b7280' }}>Agent Tool:</span> {task.agentTool}</div>
          <div><span style={{ color: '#6b7280' }}>Project:</span> {task.project.name}</div>
          <div><span style={{ color: '#6b7280' }}>Status:</span> {task.status}</div>
          <div><span style={{ color: '#6b7280' }}>Approval Required:</span> {task.approvalRequired ? 'Yes' : 'No'}{task.approval?.approved === true ? ' — Approved' : task.approval?.approved === false ? ' — Rejected' : ''}</div>
        </div>
      </Section>

      {/* Generated Prompt */}
      <Section title="Generated Prompt">
        <pre className="bg-gray-50 border rounded p-3 text-xs whitespace-pre-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {prompt}
        </pre>
      </Section>

      {/* Latest Operator Session */}
      <Section title="Operator Session (latest)">
        {!latestSession ? (
          <p className="text-sm" style={{ color: '#6b7280' }}>No operator sessions recorded.</p>
        ) : (
          <div className="text-sm space-y-2">
            <div className="flex gap-3 flex-wrap">
              {latestSession.recommendedAction && (
                <Badge
                  text={latestSession.recommendedAction}
                  style={DECISION_STYLE[latestSession.recommendedAction] ?? { background: '#f3f4f6', color: '#374151' }}
                />
              )}
              {latestSession.seniorApprovalRequired && (
                <Badge text="Senior Approval Required" style={{ background: '#ede9fe', color: '#5b21b6' }} />
              )}
            </div>

            {latestSession.decisionReason && (
              <p className="text-xs" style={{ color: '#6b7280' }}>{latestSession.decisionReason}</p>
            )}

            {latestSession.riskFlags.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Risk Flags</p>
                <div className="flex flex-wrap gap-1">
                  {latestSession.riskFlags.map((flag) => (
                    <Badge key={flag} text={flag} style={{ background: '#fee2e2', color: '#b91c1c' }} />
                  ))}
                </div>
              </div>
            )}

            {latestSession.missingEvidence.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Missing Evidence</p>
                <div className="flex flex-wrap gap-1">
                  {latestSession.missingEvidence.map((e) => (
                    <Badge key={e} text={e} style={{ background: '#fef9c3', color: '#a16207' }} />
                  ))}
                </div>
              </div>
            )}

            {latestSession.nextPrompt && (
              <div>
                <p className="text-xs font-medium mb-1">Recommended Next Prompt</p>
                <pre className="bg-gray-50 border rounded p-2 text-xs whitespace-pre-wrap" style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {latestSession.nextPrompt}
                </pre>
              </div>
            )}

            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Session {latestSession.id.slice(0, 8)} · Step {latestSession.currentStep} · {latestSession.createdAt.toISOString().split('T')[0]}
              {task.operatorSessions.length > 1 && ` · +${task.operatorSessions.length - 1} more`}
            </p>
          </div>
        )}
      </Section>

      {/* Instructions */}
      <Section title={`Instructions (${task.instructions.length})`}>
        {task.instructions.length === 0 ? (
          <p className="text-sm" style={{ color: '#6b7280' }}>No instructions linked.</p>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border-b py-1 text-left pr-3">Title</th>
                <th className="border-b py-1 text-left pr-3">Status</th>
                <th className="border-b py-1 text-left pr-3">StateVersion</th>
                <th className="border-b py-1 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {task.instructions.map((instr) => (
                <tr key={instr.id}>
                  <td className="py-1 pr-3">{instr.title}</td>
                  <td className="py-1 pr-3">
                    <Badge text={instr.status} style={STATUS_STYLE[instr.status] ?? { background: '#f3f4f6', color: '#374151' }} />
                  </td>
                  <td className="py-1 pr-3" style={{ fontFamily: 'monospace', color: '#6b7280' }}>
                    {instr.stateVersion ? instr.stateVersion.slice(0, 12) : '—'}
                  </td>
                  <td className="py-1" style={{ color: '#6b7280' }}>{instr.updatedAt.toISOString().split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Audit Summary */}
      <Section title="Recent Audit Entries">
        {task.audits.length === 0 ? (
          <p className="text-sm" style={{ color: '#6b7280' }}>No audit entries.</p>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border-b py-1 text-left pr-3">When</th>
                <th className="border-b py-1 text-left pr-3">Event</th>
                <th className="border-b py-1 text-left">Instruction</th>
              </tr>
            </thead>
            <tbody>
              {task.audits.map((log) => (
                <tr key={log.id}>
                  <td className="py-1 pr-3" style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {log.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                  </td>
                  <td className="py-1 pr-3" style={{ fontFamily: 'monospace' }}>{log.event}</td>
                  <td className="py-1" style={{ color: '#6b7280' }}>
                    {log.instruction ? log.instruction.title.slice(0, 30) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
          <Link href={`/audit?taskId=${task.id}`} className="text-blue-600 underline">Full audit log for this task →</Link>
        </p>
      </Section>

      {/* Agent Run Summary */}
      {task.agentRuns.length > 0 && (
        <Section title="Recent Agent Runs">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border-b py-1 text-left pr-3">Run ID</th>
                <th className="border-b py-1 text-left pr-3">Tool</th>
                <th className="border-b py-1 text-left pr-3">Status</th>
                <th className="border-b py-1 text-left pr-3">Evals</th>
                <th className="border-b py-1 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {task.agentRuns.map((run) => {
                const passCount = run.evaluations.filter((e) => e.passed).length;
                return (
                  <tr key={run.id}>
                    <td className="py-1 pr-3" style={{ fontFamily: 'monospace' }}>{run.id.slice(0, 8)}</td>
                    <td className="py-1 pr-3">{run.selectedTool}</td>
                    <td className="py-1 pr-3">{run.status}</td>
                    <td className="py-1 pr-3">
                      {run.evaluations.length > 0
                        ? `${passCount}/${run.evaluations.length} passed`
                        : '—'}
                    </td>
                    <td className="py-1" style={{ color: '#6b7280' }}>{run.startedAt.toISOString().split('T')[0]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      <div className="pt-4">
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          Report generated {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC ·{' '}
          <Link href={`/tasks/${task.id}`} className="text-blue-600 underline">Back to task detail</Link>
          {' · '}
          <Link href="/audit" className="text-blue-600 underline">Audit log</Link>
        </p>
      </div>
    </div>
  );
}
