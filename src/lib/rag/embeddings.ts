/**
 * RAG Foundation — Embedding provider (PR 2.4).
 *
 * Hard safety rules:
 * - When FEATURE_RAG_EMBED=false (the default), all functions return deterministic
 *   stub embeddings (zero vector or keyword hash). No real API calls are ever made.
 * - When FEATURE_RAG_EMBED=true, OPENAI_API_KEY (or a compatible provider) must be
 *   set or an error is thrown (fail-closed — never silently falls back to stub).
 * - This module NEVER writes Approval.approved — embeddings are evidence only.
 *
 * The EvidenceChunk model stores content + embedding for retrieval-augmented
 * governance analysis. Retrieval is done by cosine similarity over the stored
 * float arrays. In stub mode the vectors are always zero, so retrieval is
 * effectively random; real embeddings are needed for semantic search.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingResult {
  /** Float32 embedding vector, length = EMBEDDING_DIM */
  vector: number[];
  /** Model identifier used to produce this embedding */
  model: string;
  /** Number of tokens consumed (0 for stub) */
  tokenCount: number;
}

export interface ChunkInput {
  content: string;
  /** Caller-supplied reference (agentRunId, instructionId, etc.) */
  sourceRef?: string;
  sourceType: 'task_instruction' | 'agent_response' | 'audit_log' | 'manual';
}

export interface RetrievedChunk {
  id: string;
  content: string;
  sourceType: string;
  sourceRef?: string | null;
  score: number; // cosine similarity [0, 1]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBEDDING_DIM = 256; // stub dimension; real providers use 1536+
export const STUB_MODEL = 'stub-v0';

// ---------------------------------------------------------------------------
// Stub embedding (deterministic, no external calls)
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic "keyword hash" embedding.
 * Not semantically meaningful — used only when FEATURE_RAG_EMBED=false.
 * The vector is stable for the same input text, enabling reproducible tests.
 */
export function buildStubEmbedding(text: string): EmbeddingResult {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);

  // Spread character codes across the vector positions (deterministic)
  for (let i = 0; i < text.length; i++) {
    const pos = i % EMBEDDING_DIM;
    vector[pos] = (vector[pos] + text.charCodeAt(i) / 256) % 1;
  }

  // Normalise to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  const normalised = vector.map((v) => v / magnitude);

  return { vector: normalised, model: STUB_MODEL, tokenCount: 0 };
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Embed a single text string.
 *
 * When FEATURE_RAG_EMBED=false (default): returns a deterministic stub vector.
 * When FEATURE_RAG_EMBED=true: throws if the embedding provider API key is not
 * configured (fail-closed). Real provider integration is a future extension point.
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  if (process.env.FEATURE_RAG_EMBED !== 'true') {
    return buildStubEmbedding(text);
  }

  // Fail-closed: provider key must be set when real embeddings are enabled
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[RAG] OPENAI_API_KEY is not set. ' +
        'Real embeddings require this environment variable when FEATURE_RAG_EMBED=true.',
    );
  }

  // Real embedding call would go here. Extension point for future implementation.
  // For safety, we throw rather than silently returning stubs.
  throw new Error(
    '[RAG] Real embedding provider not yet implemented. ' +
      'Set FEATURE_RAG_EMBED=false to use stub embeddings.',
  );
}

/**
 * Serialize an embedding vector to the string format stored in EvidenceChunk.embedding.
 * Format: JSON array of floats, space-separated for readability.
 */
export function serializeEmbedding(vector: number[]): string {
  return JSON.stringify(vector);
}

/**
 * Deserialize an embedding from the string stored in EvidenceChunk.embedding.
 * Returns null if the string is missing or malformed.
 */
export function deserializeEmbedding(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is number => typeof v === 'number');
  } catch {
    return null;
  }
}
