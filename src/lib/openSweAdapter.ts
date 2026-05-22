/**
 * Adapter for integrating with the Open SWE coding‑agent framework.  In phase 1
 * this module provides a minimal interface and a manual execution pathway.
 *
 * Open SWE is designed to orchestrate asynchronous coding agents on top of
 * Deep Agents.  A complete integration would involve packaging tasks into
 * sandboxes and invoking the agent harness with a curated toolset.  That
 * functionality is out of scope for the MVP, so we expose a simple stub
 * function and document where additional integration work should occur.
 */

export interface OpenSweResult {
  /**
   * Raw response returned from Open SWE or pasted by the user.  In phase 1
   * this may be empty when the agent run is manual.
   */
  response: string;
}

/**
 * Submit a prompt to Open SWE.  When an API integration is available this
 * function should make an HTTP request or use an SDK to send the prompt to
 * the Open SWE manager.  Until then the function returns a placeholder and
 * the user is expected to execute the prompt manually (e.g. via CLI or
 * ChatGPT) and paste the response back into the application.
 *
 * @param prompt Full system prompt produced by the prompt builder.
 * @returns An object containing a placeholder response message.
 */
export async function submitToOpenSwe(prompt: string): Promise<OpenSweResult> {
  // TODO: implement integration with the Open SWE API or CLI.  See
  // https://github.com/langchain-ai/open-swe for documentation.  For now we
  // return a stub that instructs the user to run the prompt manually.
  return {
    response:
      'Open SWE integration is not yet implemented.  Please copy the generated prompt, run it manually using your preferred agent (e.g. Claude Code, Codex, or OpenClaw), and paste the response here.',
  };
}