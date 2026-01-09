export type RetryCondition = (error: unknown) => boolean;

// Default retry configuration constants
export const DEFAULT_RETRY_ATTEMPTS = 3 as const;
export const DEFAULT_RETRY_BASE_MS = 200 as const;
export const DEFAULT_RETRY_MAX_MS = 2000 as const;
export const DEFAULT_RETRY_MAX_ELAPSED_MS = 15000 as const;

export function isRetryableError(error: unknown): boolean {
  // Basic heuristics: retry network errors and HTTP 5xx or 429
  if (error && typeof error === "object") {
    const anyErr = error as { status?: unknown; code?: unknown; message?: unknown };
    const status = anyErr.status ?? anyErr.code;
    // Playwright/Node fetch network codes often expose via error.message or code
    if (typeof status === "number") {
      return status === 429 || (status >= 500 && status <= 599);
    }
    const msg = String(anyErr.message ?? "").toLowerCase();
    if (
      msg.includes("ecconnreset") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("timeout") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Retry a function with exponential backoff and jitter.
 * Supports custom retry conditions and honors Retry-After headers.
 * 
 * @param fn - The async function to retry
 * @param attempts - Maximum number of attempts (default: 3)
 * @param baseMs - Base delay in milliseconds for exponential backoff (default: 200)
 * @param maxMs - Maximum delay between retries (default: 2000)
 * @param maxElapsedMs - Maximum total time for all retries (default: 15000)
 * @param shouldRetry - Predicate to determine if error is retryable (default: always retry)
 * @returns Promise resolving to the function result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```typescript
 * // Simple retry with defaults
 * const result = await withRetry(() => apiClient.get('/data'));
 * 
 * // Retry only retryable errors with custom config
 * const result = await withRetry(
 *   () => apiClient.get('/data'),
 *   5,  // attempts
 *   100, // base delay
 *   3000, // max delay
 *   30000, // max elapsed
 *   isRetryableError // custom condition
 * );
 * 
 * // Honor Retry-After headers (retryAfterMs on error object)
 * const result = await withRetry(
 *   () => apiClient.get('/rate-limited'),
 *   3,
 *   200,
 *   2000,
 *   15000,
 *   (err) => isRetryableError(err)
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = DEFAULT_RETRY_ATTEMPTS,
  baseMs: number = DEFAULT_RETRY_BASE_MS,
  maxMs: number = DEFAULT_RETRY_MAX_MS,
  maxElapsedMs: number = DEFAULT_RETRY_MAX_ELAPSED_MS,
  // Default: retry on any error. Callers can pass a stricter predicate.
  shouldRetry: RetryCondition = () => true
): Promise<T> {
  // Validate parameters
  if (attempts < 1) {
    throw new Error(`retry attempts must be >= 1, got ${attempts}`);
  }
  if (baseMs < 0 || maxMs < 0 || maxElapsedMs <= 0) {
    throw new Error("retry delay parameters must be non-negative (maxElapsedMs must be > 0)");
  }
  if (maxMs < baseMs) {
    throw new Error(`maxMs (${maxMs}) must be >= baseMs (${baseMs})`);
  }
  
  let lastError: unknown;
  const start = Date.now();
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === attempts - 1) break;
      if (!shouldRetry(e)) break;
      const elapsed = Date.now() - start;
      if (elapsed >= maxElapsedMs) break;
      const jitter = Math.random() * 50;
      const backoff = Math.min(baseMs * Math.pow(2, i) + jitter, maxMs);
      const retryAfter = parseRetryAfterMs(e);
      const delay = Math.max(backoff, retryAfter ?? 0);
      const remaining = maxElapsedMs - elapsed;
      if (remaining <= 0) break;
      await new Promise((r) => setTimeout(r, Math.min(delay, remaining)));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Retry failed: ${String(lastError)}`);
}

function parseRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const retryAfterMs = (error as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    // Cap at 60 seconds to prevent excessive waits from misbehaving servers
    return Math.min(retryAfterMs, 60000);
  }
  return undefined;
}
