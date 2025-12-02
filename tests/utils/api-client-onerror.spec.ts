import { describe, it, expect, vi } from "vitest";
import type { APIRequestContext } from "@playwright/test";
import { ApiClient, ApiClientError } from "../../src/utils/api-client";

// Minimal request context stub to force failures
class FailingContext {
  async fetch(): Promise<{
    status: () => number;
    ok: () => boolean;
    headers: () => Record<string, string>;
    text: () => Promise<string>;
  }> {
    return {
      status: () => 500,
      ok: () => false,
      headers: () => ({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ error: "boom" }),
    };
  }
  async dispose(): Promise<void> {
    // no-op
  }
}

describe("ApiClient onError hook", () => {
  it("invokes onError on non-ok response and throws ApiClientError", async () => {
    const onError = vi.fn();
    const client = new ApiClient({
      name: "test-client",
      requestFactory: async () => new FailingContext() as unknown as APIRequestContext,
      onError,
    });

    await expect(client.get("https://service.local/api"))
      .rejects
      .toBeInstanceOf(ApiClientError);

    expect(onError).toHaveBeenCalledTimes(1);
    const arg = onError.mock.calls[0][0] as ApiClientError;
    expect(arg.status).toBe(500);
    await client.dispose();
  });
});
