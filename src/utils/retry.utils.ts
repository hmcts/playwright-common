export type RetryCondition = (error: unknown) => boolean;

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

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 200,
  maxMs = 2000,
  maxElapsedMs = 15000,
  // Default: retry on any error. Callers can pass a stricter predicate.
  shouldRetry: RetryCondition = () => true
): Promise<T> {
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
      const delay = Math.min(baseMs * Math.pow(2, i) + jitter, maxMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Retry failed: ${String(lastError)}`);
}
