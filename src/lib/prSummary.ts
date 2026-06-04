/**
 * Deterministic PR feature summary — no LLM calls.
 * Takes PR title and body and returns a structured analysis.
 */

export interface PRSummary {
  whatChanged: string;
  whyItMatters: string;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  riskReason: string;
  validationEvidence: string[];
  missingEvidence: string[];
  evidenceQuality: 'strong' | 'adequate' | 'weak' | 'missing';
}

// Keywords that indicate high-risk changes
const HIGH_RISK_PATTERNS = [
  /auth(?:entication|orization|)/i,
  /secret|token|credential|password|api[_\s-]?key/i,
  /database|migration|schema|ALTER\s+TABLE|DROP\s+TABLE/i,
  /production|prod\b/i,
  /security|vulnerability|cve-/i,
  /permission|rbac|role|access[_\s-]?control/i,
  /payment|billing|stripe|checkout/i,
  /private[_\s-]key|ssh|tls|ssl|cert/i,
];

const MEDIUM_RISK_PATTERNS = [
  /deploy|release|rollout/i,
  /config(?:uration)?|settings|env(?:ironment)?/i,
  /dependency|dep(?:s)?\b|upgrade|downgrade/i,
  /refactor/i,
  /breaking[_\s-]?change/i,
  /api\s+change|api\s+version/i,
];

const EVIDENCE_POSITIVE_PATTERNS: { pattern: RegExp; evidence: string }[] = [
  { pattern: /test(?:s|ed|ing)?\s+pass/i, evidence: 'Tests passing confirmed' },
  { pattern: /\bci\b.*pass|pass.*\bci\b/i, evidence: 'CI passing' },
  { pattern: /build.*(?:pass|clean|success)|(?:pass|clean|success).*build/i, evidence: 'Build clean' },
  { pattern: /no\s+(?:breaking|regression)/i, evidence: 'No breaking changes claimed' },
  { pattern: /reviewed|code[_\s-]?review/i, evidence: 'Code review noted' },
  { pattern: /test\s+plan|## test/i, evidence: 'Test plan present' },
  { pattern: /screenshot|screen[_\s-]?shot/i, evidence: 'Screenshots provided' },
  { pattern: /migration.*tested|tested.*migration/i, evidence: 'Migration tested' },
  { pattern: /\d+\s+tests?\s+pass/i, evidence: 'Specific test count confirmed' },
  { pattern: /validated|validation/i, evidence: 'Validation noted' },
];

const EVIDENCE_NEGATIVE_PATTERNS: { pattern: RegExp; missing: string }[] = [
  { pattern: /TODO|FIXME|WIP\b|work in progress/i, missing: 'Contains TODO/WIP markers' },
  { pattern: /not\s+tested|untested/i, missing: 'Code is explicitly untested' },
  { pattern: /no\s+tests?/i, missing: 'Explicitly states no tests' },
  { pattern: /draft|do not merge|don'?t merge/i, missing: 'Draft or do-not-merge flag present' },
];

/**
 * Extract a plain "what changed" from the PR title.
 * Strips common PR prefixes like feat:, fix:, chore:, etc.
 */
export function extractWhatChanged(title: string): string {
  if (!title || title.trim().length === 0) return 'No title provided';

  // Strip conventional commit prefix: feat(scope): / fix: / chore: etc.
  const stripped = title.replace(/^[a-z]+(?:\([^)]+\))?:\s*/i, '').trim();
  return stripped.length > 0 ? stripped : title.trim();
}

/**
 * Infer risk level from title and body combined.
 */
export function inferRiskLevel(title: string, body: string | null): { level: 'low' | 'medium' | 'high' | 'unknown'; reason: string } {
  const combined = `${title} ${body ?? ''}`;

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      return { level: 'high', reason: `Detected high-risk keyword pattern: ${pattern.source.slice(0, 40)}` };
    }
  }

  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      return { level: 'medium', reason: `Detected medium-risk keyword pattern: ${pattern.source.slice(0, 40)}` };
    }
  }

  if (!body || body.trim().length < 20) {
    return { level: 'unknown', reason: 'Insufficient description to determine risk' };
  }

  return { level: 'low', reason: 'No high or medium risk keywords detected' };
}

/**
 * Extract "why it matters" from PR body — looks for common sections.
 */
export function extractWhyItMatters(body: string | null): string {
  if (!body || body.trim().length === 0) return 'No description provided.';

  // Try to find a "Why" or "Motivation" or "Summary" section
  const whyMatch = body.match(/(?:##?\s*(?:why|motivation|context|background|reason)[^\n]*\n)([\s\S]*?)(?:\n##?|$)/i);
  if (whyMatch) {
    const text = whyMatch[1].trim().replace(/^\s*[-*]\s*/gm, '').slice(0, 300);
    if (text.length > 20) return text;
  }

  const summaryMatch = body.match(/(?:##?\s*(?:summary|overview)[^\n]*\n)([\s\S]*?)(?:\n##?|$)/i);
  if (summaryMatch) {
    const text = summaryMatch[1].trim().replace(/^\s*[-*]\s*/gm, '').slice(0, 300);
    if (text.length > 20) return text;
  }

  // Fall back to first non-empty paragraph
  const firstParagraph = body.split(/\n\n+/).find((p) => p.trim().length > 20);
  if (firstParagraph) {
    return firstParagraph.replace(/##?\s*[^\n]+\n/, '').trim().slice(0, 300);
  }

  return 'Description present but no clear motivation section found.';
}

/**
 * Scan body for positive evidence signals.
 */
export function extractValidationEvidence(title: string, body: string | null): string[] {
  const combined = `${title} ${body ?? ''}`;
  const found: string[] = [];
  for (const { pattern, evidence } of EVIDENCE_POSITIVE_PATTERNS) {
    if (pattern.test(combined)) found.push(evidence);
  }
  return found;
}

/**
 * Scan body for missing evidence signals.
 */
export function extractMissingEvidence(title: string, body: string | null): string[] {
  const combined = `${title} ${body ?? ''}`;
  const missing: string[] = [];
  for (const { pattern, missing: m } of EVIDENCE_NEGATIVE_PATTERNS) {
    if (pattern.test(combined)) missing.push(m);
  }
  if (!body || body.trim().length < 20) missing.push('No PR description — cannot assess evidence');
  if (body && body.trim().length > 0 && !/test/i.test(body)) missing.push('No test confirmation in description');
  return [...new Set(missing)];
}

/**
 * Score evidence quality.
 */
export function scoreEvidenceQuality(
  positive: string[],
  missing: string[],
  body: string | null,
): 'strong' | 'adequate' | 'weak' | 'missing' {
  if (!body || body.trim().length < 20) return 'missing';
  if (missing.some((m) => m.includes('TODO') || m.includes('WIP') || m.includes('Draft'))) return 'weak';
  if (positive.length >= 3) return 'strong';
  if (positive.length >= 1) return 'adequate';
  return 'weak';
}

/**
 * Produce a full PR summary from title and body.
 */
export function summarisePR(title: string, body: string | null): PRSummary {
  const whatChanged = extractWhatChanged(title);
  const whyItMatters = extractWhyItMatters(body);
  const { level: riskLevel, reason: riskReason } = inferRiskLevel(title, body);
  const validationEvidence = extractValidationEvidence(title, body);
  const missingEvidence = extractMissingEvidence(title, body);
  const evidenceQuality = scoreEvidenceQuality(validationEvidence, missingEvidence, body);

  return {
    whatChanged,
    whyItMatters,
    riskLevel,
    riskReason,
    validationEvidence,
    missingEvidence,
    evidenceQuality,
  };
}
