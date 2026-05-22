/**
 * Generate a pseudo‑random UUID (version 4).  This implementation creates
 * RFC‑4122 compliant identifiers using random numbers.  It avoids pulling in
 * external dependencies so the file remains self contained.
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Simplified client for sending prompt/response traces to Langfuse.  This
 * implementation uses the Langfuse HTTP API directly via fetch rather than
 * depending on a heavy SDK.  Only the minimal endpoints needed for phase 1
 * are supported.  See https://langfuse.com/docs/observability/get-started
 * for details.
 */

const baseUrl = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';
const publicKey = process.env.LANGFUSE_PUBLIC_KEY ?? '';
const secretKey = process.env.LANGFUSE_SECRET_KEY ?? '';

interface Trace {
  id: string;
  taskId: string;
  agentRunId?: string;
  /** Additional metadata associated with the trace */
  metadata?: Record<string, any>;
}

/**
 * Create a new trace for a task or agent run.  A trace groups related
 * observations (prompts, responses, evaluation results).  You must call
 * `createTrace` before logging observations.
 */
export async function createTrace(taskId: string, agentRunId?: string, metadata: Record<string, any> = {}): Promise<Trace> {
  const id = uuidv4();
  const payload = {
    traceId: id,
    taskId,
    agentRunId,
    metadata,
  };
  // In a real implementation this would perform a POST to
  // `${baseUrl}/api/traces` with authentication headers.  Because the MVP
  // does not execute external network calls, we simply return the object.
  return { id, taskId, agentRunId, metadata };
}

/**
 * Log an observation (prompt, response, evaluation result) to Langfuse.  Each
 * observation is associated with a trace.  The Langfuse API expects
 * observations to be sent as separate entries.  For the MVP we stub this
 * function and return immediately.
 */
export async function logObservation(trace: Trace, type: 'prompt' | 'response' | 'evaluation', content: string, metadata: Record<string, any> = {}): Promise<void> {
  // Compose the request body.  In production you would send this to
  // `${baseUrl}/api/observations` along with the trace identifier and
  // authentication headers.  See Langfuse docs for the expected payload.
  const body = {
    traceId: trace.id,
    type,
    content,
    metadata,
  };
  // TODO: perform network call using fetch when integrating for real.
  // await fetch(`${baseUrl}/api/observations`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'X-API-KEY': publicKey,
  //     'X-API-SECRET': secretKey,
  //   },
  //   body: JSON.stringify(body),
  // });
  console.info('Langfuse observation logged', body);
}