import { describe, it, expect } from "vitest";
import { withRetry, DEFAULT_RETRY_ATTEMPTS } from "../../src/utils/retry.utils";

describe("withRetry parameter validation", () => {
  it("throws error when attempts < 1", async () => {
    await expect(
      withRetry(() => Promise.resolve(42), 0)
    ).rejects.toThrow("retry attempts must be >= 1");
  });

  it("throws error when baseMs is negative", async () => {
    await expect(
      withRetry(() => Promise.resolve(42), 3, -100)
    ).rejects.toThrow("retry delay parameters must be non-negative");
  });

  it("throws error when maxMs < baseMs", async () => {
    await expect(
      withRetry(() => Promise.resolve(42), 3, 1000, 500)
    ).rejects.toThrow("maxMs (500) must be >= baseMs (1000)");
  });

  it("accepts valid parameters", async () => {
    const result = await withRetry(() => Promise.resolve(42), 3, 100, 1000);
    expect(result).toBe(42);
  });
});
