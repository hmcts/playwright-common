import { describe, expect, it, vi } from "vitest";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import {
  ApiClient,
  ApiClientError,
  buildApiAttachment,
} from "../../src/utils/api-client.js";
import type { ApiLogEntry } from "../../src/utils/api-client.js";
import { REDACTED_VALUE } from "../../src/logging/redaction.js";

class FakeApiResponse {
  constructor(
    private readonly statusCode: number,
    private readonly body: string,
    private readonly headerMap: Record<string, string> = {}
  ) {}

  status(): number {
    return this.statusCode;
  }

  ok(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  headers(): Record<string, string> {
    return this.headerMap;
  }

  async text(): Promise<string> {
    return this.body;
  }
}

function createContextMock(response: APIResponse) {
  return {
    fetch: vi.fn(async () => response),
    dispose: vi.fn(),
  } as unknown as APIRequestContext;
}

describe("ApiClient", () => {
  it("returns parsed data and sanitised log entry", async () => {
    const responseBody = JSON.stringify({ token: "abc123", result: true });
    const response = new FakeApiResponse(200, responseBody, {
      "content-type": "application/json",
    }) as unknown as APIResponse;

    const context = createContextMock(response);
    const entries: string[] = [];

    const client = new ApiClient({
      baseUrl: "https://example.com",
      requestFactory: async () => context,
      captureRawBodies: false,
      onResponse: (entry) => {
        entries.push(JSON.stringify(entry));
      },
    });

    const result = await client.post<{ token: string; result: boolean }>(
      "/test",
      {
        data: { username: "user", password: "super-secret" },
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data.token).toBe("abc123");
    expect(entries.length).toBe(1);
    const entry = JSON.parse(entries[0]);
    expect(entry.request.data.password).toBe(REDACTED_VALUE);
    expect(entry.response.body.token).toBe(REDACTED_VALUE);
  });

  it("throws ApiClientError on non-2xx responses", async () => {
    const response = new FakeApiResponse(
      500,
      JSON.stringify({ error: "server error" })
    ) as unknown as APIResponse;

    const context = createContextMock(response);

    const client = new ApiClient({
      baseUrl: "https://example.com",
      requestFactory: async () => context,
    });

    await expect(
      client.get("/failing-endpoint")
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it("can include raw payloads when captureRawBodies is true", async () => {
    const response = new FakeApiResponse(
      200,
      JSON.stringify({ token: "123" })
    ) as unknown as APIResponse;

    const context = createContextMock(response);
    const logs: string[] = [];

    const client = new ApiClient({
      baseUrl: "https://example.com",
      requestFactory: async () => context,
      captureRawBodies: true,
      onResponse: (entry) => {
        logs.push(JSON.stringify(entry));
      },
    });

    const result = await client.post("/raw", {
      data: { token: "raw-token" },
    });

    expect(result.rawBody).toContain("token");
    const entry = JSON.parse(logs[0]);
    expect(entry.rawResponse).toContain("token");
  });

  it("builds attachment payload", async () => {
    const response = new FakeApiResponse(200, JSON.stringify({ ok: true })) as unknown as APIResponse;
    const context = createContextMock(response);
    let storedEntry: ApiLogEntry | undefined;

    const client = new ApiClient({
      baseUrl: "https://example.com",
      requestFactory: async () => context,
      captureRawBodies: true,
      onResponse: (entry) => (storedEntry = entry),
    });

    await client.get("/health");

    expect(storedEntry).toBeDefined();
    const prevDebug = process.env.PLAYWRIGHT_DEBUG_API;
    process.env.PLAYWRIGHT_DEBUG_API = "true";
    const attachment = buildApiAttachment(storedEntry!, { includeRaw: true });
    process.env.PLAYWRIGHT_DEBUG_API = prevDebug;
    expect(attachment.contentType).toBe("application/json");
    const body = JSON.parse(attachment.body);
    expect(body.rawResponse).toBeDefined();
  });
});
