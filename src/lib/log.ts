/**
 * Server-side error logging for API routes.
 * Logs enough context to diagnose failures without ever echoing
 * request bodies, credentials, or tokens.
 */
export function logError(context: string, error: unknown): void {
  const detail =
    error instanceof Error ? error.message :
    typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) :
    String(error);
  console.error(`[api:${context}] ${detail}`);
}
