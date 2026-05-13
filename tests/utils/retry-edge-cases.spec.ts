import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../src/utils/retry.utils";

describe("withRetry edge cases and validation", () => {
  it("throws error when maxElapsedMs is 0", async () => {
    await expect(
      withRetry(
        () => Promise.reject(new Error("fail")),
        3,
        200,
        2000,
        0 // maxElapsedMs = 0
      )
    ).rejects.toThrow("retry delay parameters must be non-negative (maxElapsedMs must be > 0)");
  });

  it("throws error when maxElapsedMs is negative", async () => {
    await expect(
      withRetry(
        () => Promise.reject(new Error("fail")),
        3,
        200,
        2000,
        -1000 // maxElapsedMs < 0
      )
    ).rejects.toThrow("retry delay parameters must be non-negative (maxElapsedMs must be > 0)");
  });

  it("caps retry-after to maximum of 60 seconds", async () => {
    vi.useFakeTimers();
    try {
      let attempt = 0;
      const startTime = Date.now();

      const promise = withRetry(
        () => {
          attempt++;
          const error = new Error("rate limited") as Error & { retryAfterMs?: number };
          error.retryAfterMs = 120000; // 2 minutes - should be capped to 60 seconds
          throw error;
        },
        2,
        100,
        2000,
        5000 // maxElapsed = 5 seconds
      ).catch(() => undefined);

      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      const elapsed = Date.now() - startTime;
      
      // Should not wait 120 seconds, should cap at 5 seconds (maxElapsed)
      expect(elapsed).toBeLessThan(6000);
      expect(attempt).toBe(2); // Should try twice
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects retry-after header when less than backoff", async () => {
    let attempt = 0;
    const delays: number[] = [];
    let lastTime = Date.now();

    try {
      await withRetry(
        () => {
          const now = Date.now();
          if (attempt > 0) {
            delays.push(now - lastTime);
          }
          lastTime = now;
          attempt++;
          
          const error = new Error("retry") as Error & { retryAfterMs?: number };
          error.retryAfterMs = 500; // 500ms retry-after
          throw error;
        },
        3,
        100, // base delay (exponential would be 100, 200, 400...)
        2000,
        10000
      );
    } catch {
      // Expected to fail
    }

    expect(attempt).toBe(3);
    // All delays should be at least 500ms (retry-after), not the exponential backoff
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(480); // Allow 20ms tolerance
    });
  });

  it("allows maxElapsedMs = 1 as valid (edge case)", async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      
      const promise = withRetry(
        () => {
          attempts++;
          throw new Error("fail");
        },
        5,
        100,
        1000,
        1 // Extremely short maxElapsedMs - should allow at least first attempt
      ).catch(() => undefined);

      await vi.advanceTimersByTimeAsync(1);
      await promise;

      // Should at least try once, even with maxElapsedMs=1
      expect(attempts).toBeGreaterThanOrEqual(1);
      // But unlikely to get more than 1-2 attempts with 1ms limit
      expect(attempts).toBeLessThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
