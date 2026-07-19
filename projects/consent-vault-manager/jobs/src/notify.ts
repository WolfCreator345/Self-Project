/**
 * Phase 2 stand-ins for real notifications. Phase 3 swaps these for actual
 * Gmail MCP / Calendar MCP calls without changing the job logic that calls
 * them — only what happens inside these two functions changes.
 */

export function logWouldEmail(message: string): void {
  console.log(`[would email] ${message}`);
}

export function logWouldNotify(message: string): void {
  console.log(`[would notify] ${message}`);
}
