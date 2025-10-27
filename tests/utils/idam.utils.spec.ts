import { PassThrough } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transports as winstonTransports } from "winston";
import type {
  ApiClient,
  ApiLogEntry,
  ApiResponsePayload,
} from "../../src/utils/api-client.js";
import { ApiClientError } from "../../src/utils/api-client.js";
import {
  IdamUtils,
  type CreateUserParams,
  type IdamTokenParams,
} from "../../src/utils/idam.utils.js";
import { createLogger } from "../../src/logging/logger.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.IDAM_WEB_URL = "https://idam.example.com";
  process.env.IDAM_TESTING_SUPPORT_URL = "https://idam-support.example.com";
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
    name: "test-client",
    method: overrides.method ?? "POST",
    url: overrides.url ?? "https://example.com",
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

describe("IdamUtils", () => {
  it("generates an IDAM token using the token client", async () => {
    const payload: IdamTokenParams = {
      grantType: "client_credentials",
      clientId: "client",
      clientSecret: "secret",
      scope: "profile",
    };

    const { instance: tokenClient, mock: tokenClientMock } =
      createApiClientMock();
    tokenClientMock.post.mockResolvedValue(
      buildResponse({ access_token: "token-value" })
    );
    const { instance: supportClient } = createApiClientMock();

    const utils = new IdamUtils({
      tokenClient,
      testingSupportClient: supportClient,
      logger: silentLogger(),
    });

    const token = await utils.generateIdamToken(payload);
    expect(token).toBe("token-value");
    expect(tokenClientMock.post).toHaveBeenCalledWith(
      "o/token",
      expect.anything()
    );
  });

  it("throws a descriptive error when token generation fails", async () => {
    const error = new ApiClientError(
      "Failed",
      500,
      buildLogEntry({
        status: 500,
        ok: false,
        response: { body: { message: "error" } },
      })
    );

    const { instance: tokenClient, mock: tokenClientMock } =
      createApiClientMock();
    tokenClientMock.post.mockImplementation(async () => {
      throw error;
    });
    const { instance: supportClient } = createApiClientMock();

    const utils = new IdamUtils({
      tokenClient,
      testingSupportClient: supportClient,
      logger: silentLogger(),
    });

    await expect(
      utils.generateIdamToken({
        grantType: "client_credentials",
        clientId: "client",
        clientSecret: "secret",
        scope: "profile",
      })
    ).rejects.toThrow(/Failed to fetch access token/);
  });

  it("creates a user through the testing support client", async () => {
    const createPayload: CreateUserParams = {
      bearerToken: "bearer",
      password: "P@ssword123",
      user: {
        email: "user@example.com",
        forename: "First",
        surname: "Last",
        roleNames: ["role"],
      },
    };

    const { instance: tokenClient } = createApiClientMock();
    const { instance: testingSupportClient, mock: supportMock } =
      createApiClientMock();
    supportMock.post.mockResolvedValue(
      buildResponse(
        {
          id: "123",
          email: createPayload.user.email,
          forename: createPayload.user.forename,
          surname: createPayload.user.surname,
          roleNames: createPayload.user.roleNames,
        },
        201
      )
    );

    const utils = new IdamUtils({
      tokenClient,
      testingSupportClient,
      logger: silentLogger(),
    });

    const result = await utils.createUser(createPayload);
    expect(result.id).toBe("123");
    expect(result.password).toBe(createPayload.password);
    expect(supportMock.post).toHaveBeenCalled();
  });

  it("fetches user information by id", async () => {
    const userInfo = {
      id: "user-id",
      email: "user@example.com",
      forename: "First",
      surname: "Last",
      roleNames: ["caseworker"],
      displayName: "First Last",
    };

    const { instance: tokenClient } = createApiClientMock();
    const { instance: testingSupportClient, mock: supportMock } =
      createApiClientMock();
    supportMock.get.mockResolvedValue(buildResponse(userInfo));

    const utils = new IdamUtils({
      tokenClient,
      testingSupportClient,
      logger: silentLogger(),
    });

    const result = await utils.getUserInfo({
      id: "user-id",
      bearerToken: "token",
    });

    expect(result).toEqual(userInfo);
    expect(supportMock.get).toHaveBeenCalledWith(
      "/test/idam/users/user-id",
      expect.any(Object)
    );
  });
});
