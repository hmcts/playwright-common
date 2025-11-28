export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 200,
  maxMs = 2000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === attempts - 1) break;
      const jitter = Math.random() * 50;
      const delay = Math.min(baseMs * Math.pow(2, i) + jitter, maxMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Retry failed: ${String(lastError)}`);
}
