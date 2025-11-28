import { describe, it, expect } from "vitest";
import { withRetry } from "../src/utils/retry.utils";

describe("withRetry", () => {
  it("resolves when function eventually succeeds", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error("temporary");
      return 42;
    };
    const res = await withRetry(fn, 3, 1, 10);
    expect(res).toBe(42);
    expect(attempts).toBe(2);
  });

  it("throws after exhausting attempts", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error("always fails");
    };
    await expect(withRetry(fn, 2, 1, 10)).rejects.toThrow(/always fails/);
    expect(attempts).toBe(2);
  });
});
