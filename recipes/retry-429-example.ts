import { withRetry, isRetryableError } from "../dist/utils/retry.utils.js";

/**
 * Example: wrap a call with retry that honours Retry-After when present.
 * Replace the `fn` body with your real API call.
 */
export async function callWith429AwareRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(
    async () => fn(),
    3, // attempts
    200, // base backoff
    2000, // max backoff
    15000, // max elapsed
    (err) => {
      if (!isRetryableError(err)) return false;
      const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
      if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
        // Simple sleep honoring Retry-After, then continue retry loop
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryAfterMs);
      }
      return true;
    }
  );
}

// Usage:
// await callWith429AwareRetry(() => apiClient.get("/some-endpoint"));
