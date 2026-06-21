// ---------------------------------------------------------------------------
// W-8: Command policy gates
//
// Pure functions — no Prisma, no side effects. Suitable for both runtime
// enforcement (when CLI execution lands in W-9+) and for the PATCH/POST
// validation APIs that manage policy records.
// ---------------------------------------------------------------------------

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

// ── Command allowlist ────────────────────────────────────────────────────────

/**
 * Returns true if the command starts with at least one of the allowed prefixes.
 * Comparison is normalised: leading/trailing whitespace stripped, single-space
 * collapsed. Empty allowlist → nothing allowed.
 */
export function isCommandAllowed(command: string, allowlist: string[]): PolicyCheckResult {
  const normalised = command.trim().replace(/\s+/g, ' ');
  if (!normalised) return { allowed: false, reason: 'Empty command' };
  if (allowlist.length === 0) return { allowed: false, reason: 'Allowlist is empty — no commands permitted' };

  for (const prefix of allowlist) {
    const p = prefix.trim();
    if (!p) continue;
    if (normalised === p || normalised.startsWith(p + ' ')) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Command "${normalised.slice(0, 80)}" does not match any allowlisted prefix`,
  };
}

// ── Workdir scoping ──────────────────────────────────────────────────────────

/**
 * Returns true if workingDir is under at least one of the allowed base paths.
 * Enforces that the path starts with the base and is followed by '/' or is equal,
 * preventing prefix attacks (e.g. /home/user2 matching /home/user).
 */
export function isWorkdirAllowed(workingDir: string, allowedBases: string[]): PolicyCheckResult {
  const dir = workingDir.trim();
  if (!dir) return { allowed: false, reason: 'Working directory is empty' };
  if (allowedBases.length === 0) return { allowed: false, reason: 'No allowed base paths configured' };

  for (const base of allowedBases) {
    const b = base.trim().replace(/\/+$/, ''); // strip trailing slashes
    if (!b) continue;
    if (dir === b || dir.startsWith(b + '/')) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Working directory "${dir}" is outside all allowed base paths`,
  };
}

// ── Log scrubbing ────────────────────────────────────────────────────────────

// Patterns are applied in order. Each replaces the captured group with a
// fixed-width redaction marker so line structure is preserved.
const SCRUB_PATTERNS: { label: string; re: RegExp }[] = [
  // Generic key=value patterns  (api_key=abc123, token=xyz)
  { label: 'kv-secret',    re: /\b((?:api[_-]?key|token|secret|password|passwd|auth|bearer)[=:\s]+)([^\s"'`,;]{4,})/gi },
  // Authorization header values
  { label: 'auth-header',  re: /(Authorization:\s*(?:Bearer|Basic|Token)\s+)([^\s"'`,;]{4,})/gi },
  // AWS-style keys (20+ uppercase alphanumeric starting AKIA)
  { label: 'aws-key',      re: /\b(AKIA[0-9A-Z]{16})\b/g },
  // Hex secrets >= 32 chars (tokens, hashes)
  { label: 'hex-secret',   re: /\b([0-9a-f]{32,64})\b/g },
  // GitHub PAT (ghp_, ghs_, github_pat_)
  { label: 'github-pat',   re: /\b(gh[ps]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  // npm tokens
  { label: 'npm-token',    re: /\b(npm_[A-Za-z0-9]{36})\b/g },
  // Anthropic API key
  { label: 'anthropic-key', re: /\b(sk-ant-[A-Za-z0-9\-_]{20,})\b/g },
  // OpenAI API key
  { label: 'openai-key',   re: /\b(sk-[A-Za-z0-9]{32,})\b/g },
  // .env style  VAR="value"
  { label: 'env-value',    re: /\b([A-Z_]{3,}(?:KEY|TOKEN|SECRET|PASS|PWD|PASSWORD|AUTH)=["']?)([^\s"'`,;\n]{4,})/g },
];

const REDACT_MARKER = '[REDACTED]';

/**
 * Scrubs a single log line, replacing known secret patterns with [REDACTED].
 * Returns the cleaned line. Does not throw.
 */
export function scrubLogLine(line: string): string {
  let out = line;
  for (const { re } of SCRUB_PATTERNS) {
    // Reset lastIndex for stateful global regexes
    re.lastIndex = 0;
    out = out.replace(re, (match, prefix, secret) => {
      // If the regex has a capture group for the secret part, redact only that.
      // If there's only one group (full match), redact the whole match.
      if (secret !== undefined) return prefix + REDACT_MARKER;
      if (prefix !== undefined) return REDACT_MARKER;
      return REDACT_MARKER;
    });
  }
  return out;
}

/**
 * Scrubs an array of log line objects, returning a new array with cleaned lines.
 */
export function scrubLogLines(lines: { ts: string; line: string }[]): { ts: string; line: string }[] {
  return lines.map((l) => ({ ts: l.ts, line: scrubLogLine(l.line) }));
}

// ── Policy body validation ───────────────────────────────────────────────────

export interface CommandPolicyBody {
  name: string;
  commandPrefixes: string[];
  allowedWorkdirs: string[];
  scrubLogs: boolean;
  enabled: boolean;
  description?: string;
}

export interface CommandPolicyPatch {
  name?: string;
  commandPrefixes?: string[];
  allowedWorkdirs?: string[];
  scrubLogs?: boolean;
  enabled?: boolean;
  description?: string;
}

const MAX_NAME = 120;
const MAX_DESCRIPTION = 500;
const MAX_PREFIXES = 100;
const MAX_PREFIX_LEN = 500;
const MAX_WORKDIRS = 50;
const MAX_WORKDIR_LEN = 500;

function validatePrefixes(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('commandPrefixes must be an array');
  if (raw.length > MAX_PREFIXES) throw new Error(`commandPrefixes exceeds ${MAX_PREFIXES} entries`);
  for (const p of raw) {
    if (typeof p !== 'string') throw new Error('each commandPrefix must be a string');
    if (p.trim().length === 0) throw new Error('commandPrefix entries must not be blank');
    if (p.length > MAX_PREFIX_LEN) throw new Error(`commandPrefix exceeds ${MAX_PREFIX_LEN} chars`);
  }
  return raw as string[];
}

function validateWorkdirs(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('allowedWorkdirs must be an array');
  if (raw.length > MAX_WORKDIRS) throw new Error(`allowedWorkdirs exceeds ${MAX_WORKDIRS} entries`);
  for (const d of raw) {
    if (typeof d !== 'string') throw new Error('each allowedWorkdir must be a string');
    if (!d.startsWith('/')) throw new Error(`allowedWorkdir must be an absolute path: "${d}"`);
    if (d.length > MAX_WORKDIR_LEN) throw new Error(`allowedWorkdir exceeds ${MAX_WORKDIR_LEN} chars`);
  }
  return raw as string[];
}

export function validateCommandPolicyBody(body: unknown): CommandPolicyBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('name is required');
  if (raw.name.length > MAX_NAME) throw new Error(`name exceeds ${MAX_NAME} chars`);

  const commandPrefixes = validatePrefixes(raw.commandPrefixes);
  const allowedWorkdirs = validateWorkdirs(raw.allowedWorkdirs);

  if (typeof raw.scrubLogs !== 'boolean') throw new Error('scrubLogs must be a boolean');
  if (typeof raw.enabled !== 'boolean') throw new Error('enabled must be a boolean');

  if ('description' in raw && raw.description !== null && typeof raw.description !== 'string') {
    throw new Error('description must be a string or null');
  }
  const description = typeof raw.description === 'string' ? raw.description.trim() : undefined;
  if (description && description.length > MAX_DESCRIPTION) throw new Error(`description exceeds ${MAX_DESCRIPTION} chars`);

  return {
    name: raw.name.trim(),
    commandPrefixes,
    allowedWorkdirs,
    scrubLogs: raw.scrubLogs,
    enabled: raw.enabled,
    ...(description ? { description } : {}),
  };
}

export function validateCommandPolicyPatch(body: unknown): CommandPolicyPatch {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const raw = body as Record<string, unknown>;
  const patch: CommandPolicyPatch = {};

  if ('name' in raw) {
    if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('name must be a non-empty string');
    if (raw.name.length > MAX_NAME) throw new Error(`name exceeds ${MAX_NAME} chars`);
    patch.name = raw.name.trim();
  }
  if ('commandPrefixes' in raw) patch.commandPrefixes = validatePrefixes(raw.commandPrefixes);
  if ('allowedWorkdirs' in raw) patch.allowedWorkdirs = validateWorkdirs(raw.allowedWorkdirs);
  if ('scrubLogs' in raw) {
    if (typeof raw.scrubLogs !== 'boolean') throw new Error('scrubLogs must be a boolean');
    patch.scrubLogs = raw.scrubLogs;
  }
  if ('enabled' in raw) {
    if (typeof raw.enabled !== 'boolean') throw new Error('enabled must be a boolean');
    patch.enabled = raw.enabled;
  }
  if ('description' in raw) {
    if (raw.description !== null && typeof raw.description !== 'string') throw new Error('description must be a string or null');
    patch.description = typeof raw.description === 'string' ? raw.description.trim() : undefined;
  }

  if (Object.keys(patch).length === 0) throw new Error('No valid fields provided');
  return patch;
}
