'use client';
import { useState } from 'react';
import Link from 'next/link';

interface LinkedPR {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  classification: string | null;
  sourceBranch: string | null;
  prUrl: string | null;
}

interface SuggestedPR extends LinkedPR {
  score: number;
  matchReason: string;
}

interface Props {
  agentRunId: string;
  projectId: string;
  initialLinked: LinkedPR[];
  userRole: string;
}

const CI_COLORS: Record<string, string> = {
  success: 'var(--green)',
  failure: 'var(--red)',
  pending: 'var(--amber)',
};

function PrRow({ pr, onUnlink, canEdit }: { pr: LinkedPR; onUnlink?: () => void; canEdit: boolean }) {
  const ciColor = pr.ciStatus ? (CI_COLORS[pr.ciStatus] ?? 'var(--text-muted)') : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: ciColor, fontSize: 13, minWidth: 14 }}>
        {pr.ciStatus === 'success' ? '✓' : pr.ciStatus === 'failure' ? '✗' : pr.ciStatus === 'pending' ? '⏳' : '○'}
      </span>
      <span style={{ fontWeight: 600, fontSize: 13, minWidth: 40, color: 'var(--text-muted)' }}>#{pr.prNumber}</span>
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pr.prUrl
          ? <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'none' }}>{pr.title}</a>
          : pr.title}
      </span>
      {pr.classification && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
          {pr.classification.replace('_', ' ')}
        </span>
      )}
      <span style={{ fontSize: 11, color: pr.merged ? 'var(--purple)' : pr.state === 'open' ? 'var(--green)' : 'var(--text-muted)' }}>
        {pr.merged ? 'merged' : pr.state}
      </span>
      {canEdit && onUnlink && (
        <button
          onClick={onUnlink}
          style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
          title="Unlink this PR"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function LinkPrsPanel({ agentRunId, projectId, initialLinked, userRole }: Props) {
  const [linked, setLinked] = useState<LinkedPR[]>(initialLinked);
  const [suggestions, setSuggestions] = useState<SuggestedPR[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const canEdit = userRole === 'admin';

  async function discover() {
    setDiscovering(true);
    setError('');
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/link-prs`);
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      const data = await res.json() as { linked: LinkedPR[]; suggestions: SuggestedPR[] };
      setLinked(data.linked);
      setSuggestions(data.suggestions);
      setShowSuggestions(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setDiscovering(false);
    }
  }

  async function saveLinks(newLinkedIds: string[]) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/agent-runs/${agentRunId}/link-prs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prIds: newLinkedIds }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to save links');
      }
      // Refresh linked list
      const refreshRes = await fetch(`/api/agent-runs/${agentRunId}/link-prs`);
      if (refreshRes.ok) {
        const d = await refreshRes.json() as { linked: LinkedPR[]; suggestions: SuggestedPR[] };
        setLinked(d.linked);
        setSuggestions(d.suggestions);
      }
      setPendingAdd(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function unlink(prId: string) {
    const newIds = linked.filter((p) => p.id !== prId).map((p) => p.id);
    await saveLinks(newIds);
  }

  async function linkSuggested(pr: SuggestedPR) {
    const newIds = [...linked.map((p) => p.id), pr.id];
    await saveLinks(newIds);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Linked Pull Requests</h3>
        {canEdit && (
          <button
            onClick={discover}
            disabled={discovering}
            className="btn btn-secondary btn-sm"
            title="Find PRs from this project that may be related to this agent run"
          >
            {discovering ? '⟳ Scanning…' : '◎ Find PRs'}
          </button>
        )}
        <Link
          href={`/projects/${projectId}/prs`}
          style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}
        >
          Browse all project PRs →
        </Link>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>✕ {error}</div>
      )}

      {linked.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
          No PRs linked to this agent run yet.
          {canEdit && ' Click "Find PRs" to scan for related pull requests.'}
        </div>
      ) : (
        <div>
          {linked.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              canEdit={canEdit}
              onUnlink={() => unlink(pr.id)}
            />
          ))}
        </div>
      )}

      {/* Suggestions panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
            Suggested matches ({suggestions.length})
          </div>
          {suggestions.map((pr) => (
            <div
              key={pr.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ flex: 1 }}>
                <PrRow pr={pr} canEdit={false} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {pr.matchReason} · score {pr.score}
                </div>
              </div>
              <button
                onClick={() => linkSuggested(pr)}
                disabled={saving || pendingAdd.has(pr.id)}
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                {pendingAdd.has(pr.id) ? '⟳' : '+ Link'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          No unlinked PRs found in this project matching the agent run timing or commit SHA.
        </div>
      )}

      {saving && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Saving…</div>
      )}
    </div>
  );
}
