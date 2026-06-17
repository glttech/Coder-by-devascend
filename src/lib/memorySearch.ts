/**
 * Repository Memory Search — deterministic multi-source search.
 * Searches PRs, tasks, audit logs, and execution traces.
 * No LLM required. Optional LLM summary gated behind FEATURE_REPO_MEMORY_LLM.
 *
 * Hard rule: FEATURE_REPO_MEMORY_LLM defaults to false. Never summarise with
 * an LLM unless the flag is explicitly set to "true" in the environment.
 */

export type MemoryResultType =
  | 'pr'
  | 'task'
  | 'audit_log'
  | 'trace'
  | 'incident';

export interface MemoryResult {
  id: string;
  type: MemoryResultType;
  title: string;
  subtitle: string;
  url: string;
  /** Short excerpt showing why this result matched. */
  excerpt: string;
  /** Structured citation fields shown under the result. */
  citations: Citation[];
  /** ISO timestamp of the most relevant date for sorting. */
  date: string | null;
  /** Classification type for PRs. */
  classification?: string;
  /** Bug state for bug PRs. */
  bugState?: string | null;
}

export interface Citation {
  label: string;
  value: string;
  url?: string;
}

export interface MemoryQuery {
  q: string;
  projectId?: string;
  types?: MemoryResultType[];
  since?: Date;
  until?: Date;
  limit?: number;
}

export interface MemorySearchResponse {
  results: MemoryResult[];
  total: number;
  query: string;
  intent: QueryIntent;
  llmSummary?: string;
}

// ── Query intent detection ─────────────────────────────────────────────────────

export type QueryIntent =
  | 'recent_features'   // "what did we build last week"
  | 'auth_changes'      // "which PR changed auth"
  | 'migrations'        // "what migrations were added"
  | 'bugs'              // "what bugs exist"
  | 'pending'           // "what is pending before production"
  | 'security'          // "security changes"
  | 'deployments'       // "deployments this week"
  | 'general';          // catch-all

const INTENT_PATTERNS: Array<{ intent: QueryIntent; patterns: RegExp[] }> = [
  // Most specific / least ambiguous first
  {
    intent: 'recent_features',
    patterns: [/what.*built|features.*added|what.*new|shipped.*last/i, /build.*last.*week/i],
  },
  {
    intent: 'security',
    // Security must precede auth_changes — "security vulnerability" is more specific than session/token
    patterns: [/security|vulnerability|CVE|XSS|CSRF|injection/i],
  },
  {
    intent: 'migrations',
    patterns: [/migrat|schema.*change|database.*change|ALTER\s+TABLE/i],
  },
  {
    intent: 'bugs',
    // Bugs must precede auth_changes — "regression in login flow" is a bug query
    patterns: [/\bbugs?\b|regression|incident|outage|broken/i],
  },
  {
    intent: 'pending',
    patterns: [/pending|unresolved|before.*prod|not.*merged|still.*open/i],
  },
  {
    intent: 'deployments',
    patterns: [/deploy|release|ship|launch/i],
  },
  {
    intent: 'auth_changes',
    // auth_changes is a broad catch-all for auth-flavoured queries without other signals
    patterns: [/\bauth\b|login|session|password|\btoken\b|\boauth\b|\brbac\b|\bpermission\b/i],
  },
];

export function detectIntent(q: string): QueryIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(q))) return intent;
  }
  return 'general';
}

// ── Excerpt builder ────────────────────────────────────────────────────────────

/**
 * Extract a ~120-char snippet from text that contains the query term.
 */
export function buildExcerpt(text: string | null | undefined, q: string): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase().split(/\s+/).find((t) => t.length > 2) ?? q.toLowerCase();
  const pos = lower.indexOf(qLower);
  if (pos === -1) return text.slice(0, 120).trim() + (text.length > 120 ? '…' : '');
  const start = Math.max(0, pos - 40);
  const end = Math.min(text.length, pos + 80);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// ── FEATURE_REPO_MEMORY_LLM gate ──────────────────────────────────────────────

/**
 * Returns true only when the LLM summarization feature flag is explicitly enabled.
 * Checked at call time — never cached — so tests can toggle it.
 */
export function isLlmSummaryEnabled(): boolean {
  return process.env.FEATURE_REPO_MEMORY_LLM === 'true';
}

/**
 * Generate an LLM summary of memory search results.
 * Only called when FEATURE_REPO_MEMORY_LLM=true AND ANTHROPIC_API_KEY is set.
 * Fails closed: throws if API key is missing when flag is true.
 */
export async function generateLlmSummary(
  query: string,
  results: MemoryResult[],
): Promise<string> {
  if (!isLlmSummaryEnabled()) {
    throw new Error('[MemorySearch] LLM summary called but FEATURE_REPO_MEMORY_LLM is not true');
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('[MemorySearch] ANTHROPIC_API_KEY is not set; cannot generate LLM summary');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const context = results
    .slice(0, 10)
    .map((r) => `[${r.type.toUpperCase()}] ${r.title} — ${r.subtitle}`)
    .join('\n');

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 256,
    system:
      'You are a concise engineering assistant. Given search results from a PR memory index, answer the user query in 2-3 sentences. Cite PR numbers and dates. Never hallucinate PRs that are not in the context.',
    messages: [
      {
        role: 'user',
        content: `Query: "${query}"\n\nResults:\n${context}\n\nAnswer briefly:`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : '';
}
