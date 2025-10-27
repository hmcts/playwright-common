import { PassThrough } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transports as winstonTransports } from "winston";
import type { ApiClient, ApiResponsePayload } from "../../src/utils/api-client.js";
import { ApiClientError } from "../../src/utils/api-client.js";
import { ServiceAuthUtils } from "../../src/utils/service-auth.utils.js";
import { createLogger } from "../../src/logging/logger.js";
import type { ApiLogEntry } from "../../src/utils/api-client.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.S2S_URL =
    "http://rpe-service-auth-provider-aat.service.core-compute-aat.internal/testing-support/lease";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function silentLogger() {
  const stream = new PassThrough();
  return createLogger({
    transports: [new winstonTransports.Stream({ stream })],
    format: "json",
  });
}

function buildLogEntry(
  overrides: Partial<ApiLogEntry> = {}
): ApiLogEntry {
  return {
    id: "log-id",
    name: "service-auth",
    method: "POST",
    url: "https://example.com",
    status: overrides.status ?? 200,
    ok: overrides.ok ?? true,
    timestamp: new Date().toISOString(),
    durationMs: overrides.durationMs ?? 1,
    correlationId: overrides.correlationId ?? "corr-id",
    request: {
      headers: {},
      data: undefined,
      form: undefined,
      query: undefined,
      ...(overrides.request ?? {}),
    },
    response: {
      headers: {},
      body: {},
      ...(overrides.response ?? {}),
    },
    error: overrides.error,
    rawRequest: overrides.rawRequest,
    rawResponse: overrides.rawResponse,
  };
}

function buildResponse<T>(
  data: T,
  status = 200
): ApiResponsePayload<T> {
  return {
    ok: status >= 200 && status < 300,
    status,
    data,
    headers: {},
    rawBody: undefined,
    logEntry: buildLogEntry({
      status,
      ok: status >= 200 && status < 300,
      response: { body: data },
    }),
  };
}

function createApiClientMock() {
  const mock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    instance: mock as unknown as ApiClient,
    mock,
  };
}

describe("ServiceAuthUtils", () => {
  it("retrieves a service auth token", async () => {
    const { instance: client, mock } = createApiClientMock();
    mock.post.mockResolvedValue(buildResponse("token-value"));
    const utils = new ServiceAuthUtils({
      client,
      logger: silentLogger(),
    });

    const token = await utils.retrieveToken({ microservice: "prl-cos-api" });
    expect(token).toBe("token-value");
    expect(mock.post).toHaveBeenCalledWith("", expect.any(Object));
  });

  it("throws a helpful error when the request fails", async () => {
    const error = new ApiClientError(
      "fail",
      401,
      buildLogEntry({
        status: 401,
        ok: false,
        response: { body: { message: "Unauthorized" } },
      })
    );

    const { instance: client, mock } = createApiClientMock();
    mock.post.mockImplementation(async () => {
      throw error;
    });

    const utils = new ServiceAuthUtils({
      client,
      logger: silentLogger(),
    });

    await expect(
      utils.retrieveToken({ microservice: "prl-cos-api" })
    ).rejects.toThrow(/Failed to fetch S2S token/);
  });
});
