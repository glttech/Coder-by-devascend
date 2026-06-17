/**
 * RAG Foundation — EvidenceChunk persistence (PR 2.4).
 *
 * Writes text chunks + embeddings to the EvidenceChunk table.
 * All DB errors are swallowed so callers are never blocked by storage failures.
 */

import prisma from '@/lib/prisma';
import { embedText, serializeEmbedding } from './embeddings';
import type { ChunkInput } from './embeddings';

export interface WriteChunkOptions {
  orgId?: string;
  taskId?: string;
  chunkIndex?: number;
}

/**
 * Write a single evidence chunk to the database.
 * Computes an embedding (stub or real depending on FEATURE_RAG_EMBED) and persists
 * both the content and the serialised vector.
 *
 * Errors are caught and logged but never re-thrown — governance must not be
 * blocked by a storage failure.
 */
export async function writeEvidenceChunk(
  chunk: ChunkInput,
  opts: WriteChunkOptions = {},
): Promise<string | null> {
  try {
    const embedding = await embedText(chunk.content);
    const record = await prisma.evidenceChunk.create({
      data: {
        orgId: opts.orgId ?? 'org_default',
        taskId: opts.taskId ?? null,
        sourceType: chunk.sourceType,
        sourceRef: chunk.sourceRef ?? null,
        content: chunk.content,
        embedding: serializeEmbedding(embedding.vector),
        embeddingModel: embedding.model,
        chunkIndex: opts.chunkIndex ?? 0,
        tokenCount: embedding.tokenCount || null,
      },
      select: { id: true },
    });
    return record.id;
  } catch (err) {
    console.error('[RAG] writeEvidenceChunk error (swallowed):', err);
    return null;
  }
}

/**
 * Write multiple evidence chunks for a task (e.g., chunked instruction text).
 * Returns the IDs of successfully written chunks (null entries omitted).
 */
export async function writeEvidenceChunks(
  chunks: ChunkInput[],
  opts: WriteChunkOptions = {},
): Promise<string[]> {
  const results = await Promise.all(
    chunks.map((chunk, i) =>
      writeEvidenceChunk(chunk, { ...opts, chunkIndex: i }),
    ),
  );
  return results.filter((id): id is string => id !== null);
}
