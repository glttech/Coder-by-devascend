export interface SessionIntelligencePatch {
  summary?: string;
  failureReason?: string;
  filesChanged?: string[];
  cliSessionId?: string; // for linking a RepositoryPR to this session (not used here directly)
}

const MAX_SUMMARY_LEN = 2000;
const MAX_FAILURE_LEN = 2000;
const MAX_FILES = 500;
const MAX_FILE_PATH_LEN = 500;

export function validateSessionIntelligencePatch(body: unknown): SessionIntelligencePatch {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  const raw = body as Record<string, unknown>;
  const patch: SessionIntelligencePatch = {};

  if ('summary' in raw) {
    if (raw.summary !== null && typeof raw.summary !== 'string') {
      throw new Error('summary must be a string or null');
    }
    const v = raw.summary as string | null;
    if (v !== null) {
      if (v.length > MAX_SUMMARY_LEN) throw new Error(`summary exceeds ${MAX_SUMMARY_LEN} chars`);
      patch.summary = v.trim() || undefined;
    } else {
      patch.summary = undefined;
    }
  }

  if ('failureReason' in raw) {
    if (raw.failureReason !== null && typeof raw.failureReason !== 'string') {
      throw new Error('failureReason must be a string or null');
    }
    const v = raw.failureReason as string | null;
    if (v !== null) {
      if (v.length > MAX_FAILURE_LEN) throw new Error(`failureReason exceeds ${MAX_FAILURE_LEN} chars`);
      patch.failureReason = v.trim() || undefined;
    } else {
      patch.failureReason = undefined;
    }
  }

  if ('filesChanged' in raw) {
    if (!Array.isArray(raw.filesChanged)) {
      throw new Error('filesChanged must be an array');
    }
    const arr = raw.filesChanged as unknown[];
    if (arr.length > MAX_FILES) throw new Error(`filesChanged exceeds ${MAX_FILES} entries`);
    for (const f of arr) {
      if (typeof f !== 'string') throw new Error('each filesChanged entry must be a string');
      if (f.length > MAX_FILE_PATH_LEN) throw new Error(`file path exceeds ${MAX_FILE_PATH_LEN} chars`);
    }
    patch.filesChanged = arr as string[];
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields provided (allowed: summary, failureReason, filesChanged)');
  }

  return patch;
}
