import { APIRequestContext, APIResponse, request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Logger } from "winston";
import { CircuitBreaker } from "./circuit-breaker.js";
import type { CircuitBreakerMetrics } from "./circuit-breaker.js";
import {
  buildRedactionState,
  sanitiseHeaders,
  sanitiseUrl,
  sanitiseValue,
  type RedactPattern,
  type RedactionState,
} from "../logging/redaction.js";
import { createLogger } from "../logging/logger.js";
import type { LoggerOptions } from "../logging/logger.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiClientOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  logger?: Logger;
  loggerOptions?: {
    serviceName?: string;
    level?: string;
    format?: "json" | "pretty";
  };
  requestFactory?: () => Promise<APIRequestContext>;
  name?: string;
  redaction?: {
    enabled?: boolean;
    patterns?: RedactPattern[];
  };
  captureRawBodies?: boolean;
  correlationId?: string;
  onResponse?: (entry: ApiLogEntry) => void;
  onError?: (error: ApiClientError) => void;
  circuitBreaker?: {
    enabled?: boolean;
    options?: {
      failureThreshold?: number;
      cooldownMs?: number;
      halfOpenMaxAttempts?: number;
    };
  };
}

type QueryParamValue = string | number | boolean | undefined;

export interface ApiRequestOptions<TBody = unknown> {
  headers?: Record<string, string>;
  data?: TBody;
  form?: Record<string, string>;
  query?: Record<string, QueryParamValue>;
  timeoutMs?: number;
  throwOnError?: boolean;
  responseType?: "auto" | "json" | "text";
  correlationId?: string;
}

export interface ApiResponsePayload<TResponse = unknown> {
  ok: boolean;
  status: number;
  data: TResponse;
  logEntry: ApiLogEntry;
  headers: Record<string, string>;
  rawBody?: string;
}

export interface ApiLogEntry {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  status: number;
  ok: boolean;
  timestamp: string;
  durationMs: number;
  correlationId?: string;
  request: {
    headers?: Record<string, string>;
    data?: unknown;
    form?: Record<string, string>;
    query?: Record<string, QueryParamValue>;
  };
  response: {
    headers?: Record<string, string>;
    body?: unknown;
  };
  error?: string;
  rawRequest?: {
    data?: unknown;
    form?: Record<string, string>;
  };
  rawResponse?: string;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly logEntry: ApiLogEntry;
  public readonly bodyPreview: string | undefined;
  public readonly endpointPath: string | undefined;
  public readonly attempt: number | undefined;
  public readonly elapsedMs: number | undefined;

  constructor(message: string, status: number, logEntry: ApiLogEntry, meta?: {
    bodyPreview?: string;
    endpointPath?: string;
    attempt?: number;
    elapsedMs?: number;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.logEntry = logEntry;
    this.bodyPreview = meta?.bodyPreview;
    this.endpointPath = meta?.endpointPath;
    this.attempt = meta?.attempt;
    this.elapsedMs = meta?.elapsedMs;
  }
}

/**
 * Lightweight HTTP client wrapper around Playwright's APIRequestContext.
 * Provides redacted structured logging, correlation IDs and optional raw body capture.
 */
export class ApiClient {
  private readonly baseUrl: string | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly requestFactory: () => Promise<APIRequestContext>;
  private readonly logger: Logger;
  private readonly name: string;
  private readonly redactionState: RedactionState;
  private readonly captureRawBodies: boolean;
  private readonly globalCorrelationId: string | undefined;
  private readonly onResponse: ((entry: ApiLogEntry) => void) | undefined;
  private readonly onError: ((error: ApiClientError) => void) | undefined;
  private readonly breaker: CircuitBreaker | undefined;
  private contextPromise: Promise<APIRequestContext> | undefined;

  constructor(options?: ApiClientOptions) {
    this.baseUrl = options?.baseUrl;
    this.defaultHeaders = { ...(options?.defaultHeaders ?? {}) };
    this.requestFactory =
      options?.requestFactory ?? (() => request.newContext());
    this.name = options?.name ?? "api-client";
    this.logger =
      options?.logger ??
      (() => {
        const loggerOpts: LoggerOptions = {
          serviceName: options?.loggerOptions?.serviceName ?? this.name,
        };
        if (options?.loggerOptions?.level !== undefined) {
          loggerOpts.level = options.loggerOptions.level;
        }
        if (options?.loggerOptions?.format !== undefined) {
          loggerOpts.format = options.loggerOptions.format;
        }
        return createLogger(loggerOpts);
      })();
    const redactionOpts: { enabled?: boolean; patterns?: RedactPattern[] } = {};
    if (options?.redaction?.enabled !== undefined) {
      redactionOpts.enabled = options.redaction.enabled;
    }
    if (options?.redaction?.patterns !== undefined) {
      redactionOpts.patterns = options.redaction.patterns;
    }
    this.redactionState = buildRedactionState(redactionOpts);
    const debugBodies =
      process.env.PLAYWRIGHT_DEBUG_API === "1" ||
      process.env.PLAYWRIGHT_DEBUG_API?.toLowerCase() === "true";
    this.captureRawBodies = options?.captureRawBodies ?? debugBodies;
    this.globalCorrelationId = options?.correlationId;
    this.onResponse = options?.onResponse;
    this.onError = options?.onError;
    this.breaker = options?.circuitBreaker?.enabled
      ? new CircuitBreaker(options.circuitBreaker.options)
      : undefined;
  }

  /** Expose circuit breaker metrics (undefined if breaker disabled) */
  public getCircuitBreakerMetrics(): CircuitBreakerMetrics | undefined {
    return this.breaker?.getMetrics();
  }

  public async dispose(): Promise<void> {
    if (this.contextPromise) {
      const context = await this.contextPromise;
      await context.dispose();
      this.contextPromise = undefined;
    }
  }

  /** Perform a GET request */
  public async get<T = unknown>(
    path: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponsePayload<T>> {
    return this.performRequest<T>("GET", path, options);
  }

  /** Perform a POST request */
  public async post<T = unknown, TBody = unknown>(
    path: string,
    options?: ApiRequestOptions<TBody>
  ): Promise<ApiResponsePayload<T>> {
    return this.performRequest<T>("POST", path, options);
  }

  /** Perform a PUT request */
  public async put<T = unknown, TBody = unknown>(
    path: string,
    options?: ApiRequestOptions<TBody>
  ): Promise<ApiResponsePayload<T>> {
    return this.performRequest<T>("PUT", path, options);
  }

  /** Perform a PATCH request */
  public async patch<T = unknown, TBody = unknown>(
    path: string,
    options?: ApiRequestOptions<TBody>
  ): Promise<ApiResponsePayload<T>> {
    return this.performRequest<T>("PATCH", path, options);
  }

  /** Perform a DELETE request */
  public async delete<T = unknown>(
    path: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponsePayload<T>> {
    return this.performRequest<T>("DELETE", path, options);
  }

  /** Core request performer handling logging, redaction and error conversion */
  private async performRequest<T>(
    method: HttpMethod,
    path: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponsePayload<T>> {
    if (this.breaker && !this.breaker.canProceed()) {
      const err = new ApiClientError(
        "Circuit open: request blocked",
        503,
        {
          id: randomUUID(),
          name: this.name,
          method,
          url: this.buildUrl(path),
          status: 503,
          ok: false,
          timestamp: new Date().toISOString(),
          durationMs: 0,
          request: {},
          response: {},
        }
      );
      this.onError?.(err);
      throw err;
    }
    const context = await this.getContext();
    const requestHeaders = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    const url = this.buildUrl(path);
    const correlationId =
      options?.correlationId ?? this.globalCorrelationId ?? randomUUID();
    const startTime = Date.now();

    type FetchOptions = Parameters<APIRequestContext["fetch"]>[1];
    const effectiveTimeout = options?.timeoutMs ?? 30_000;
    let requestOptions: FetchOptions = {
      method,
      headers: requestHeaders,
      timeout: effectiveTimeout,
    };
    const builtParams = this.buildParams(options?.query);
    if (builtParams !== undefined) {
      requestOptions = { ...requestOptions, params: builtParams };
    }
    if (options?.data !== undefined) {
      requestOptions = { ...requestOptions, data: options.data };
    }
    if (options?.form !== undefined) {
      requestOptions = { ...requestOptions, form: options.form };
    }
    const response = await context.fetch(url, requestOptions);

    const durationMs = Date.now() - startTime;
    const status = response.status();
    const ok = response.ok();
    const responseHeaders = response.headers();

    const rawBody = await safeReadBody(response);
    const parsedBody = parseBody<T>(rawBody, options?.responseType);
    const sanitisedRequestHeaders = sanitiseHeaders(
      requestHeaders,
      this.redactionState
    );
    const sanitisedResponseHeaders = sanitiseHeaders(
      responseHeaders,
      this.redactionState
    );
    const sanitisedRequestData = sanitiseValue<unknown>(
      options?.data,
      this.redactionState
    );
    const sanitisedForm = sanitiseValue<Record<string, string> | undefined>(
      options?.form,
      this.redactionState
    );
    const sanitisedQuery = sanitiseValue<Record<string, QueryParamValue> | undefined>(
      options?.query,
      this.redactionState
    );
    const sanitisedResponseBody: unknown = sanitiseValue(
      parsedBody,
      this.redactionState,
      "responseBody"
    );

    const requestLog: ApiLogEntry["request"] = {};
    if (sanitisedRequestHeaders) {
      requestLog.headers = sanitisedRequestHeaders;
    }
    if (sanitisedRequestData !== undefined) {
      requestLog.data = sanitisedRequestData;
    }
    if (sanitisedForm !== undefined) {
      requestLog.form = sanitisedForm;
    }
    if (sanitisedQuery !== undefined) {
      requestLog.query = sanitisedQuery;
    }

    const responseLog: ApiLogEntry["response"] = {};
    if (sanitisedResponseHeaders) {
      responseLog.headers = sanitisedResponseHeaders;
    }
    if (sanitisedResponseBody !== undefined) {
      responseLog.body = sanitisedResponseBody;
    }

    const logEntry: ApiLogEntry = {
      id: randomUUID(),
      name: this.name,
      method,
      url: sanitiseUrl(url, this.redactionState),
      status,
      ok,
      timestamp: new Date(startTime).toISOString(),
      durationMs,
      correlationId,
      request: requestLog,
      response: responseLog,
    };
    if (this.captureRawBodies) {
      const rawReq: NonNullable<ApiLogEntry["rawRequest"]> = {};
      if (options?.data !== undefined) rawReq.data = options.data;
      if (options?.form !== undefined) rawReq.form = options.form;
      if (Object.keys(rawReq).length > 0) {
        logEntry.rawRequest = rawReq;
      }
      if (rawBody !== undefined) {
        logEntry.rawResponse = rawBody;
      }
    }

    if (!ok) {
      logEntry.error = `Request failed with status ${status}`;
    }

    this.logger.log({
      level: ok ? "info" : "error",
      message: `${method} ${logEntry.url} -> ${status}`,
      correlationId,
      durationMs,
      apiCall: logEntry,
    });

    this.onResponse?.(logEntry);

    if (!ok && options?.throwOnError !== false) {
      const err = new ApiClientError(
        `Request failed with status ${status}`,
        status,
        logEntry,
        {
          bodyPreview:
            typeof parsedBody === "string"
              ? parsedBody.slice(0, 2048)
              : JSON.stringify(parsedBody ?? "", null, 2).slice(0, 2048),
          endpointPath: this.buildUrl(path),
          elapsedMs: durationMs,
        }
      );
      this.onError?.(err);
      this.breaker?.onFailure();
      throw err;
    }

    this.breaker?.onSuccess();

    const payload: ApiResponsePayload<T> = {
      ok,
      status,
      data: parsedBody,
      logEntry,
      headers: responseHeaders,
    };
    if (this.captureRawBodies && rawBody !== undefined) {
      payload.rawBody = rawBody;
    }
    return payload;
  }

  /** Lazily build and cache the Playwright request context */
  private async getContext(): Promise<APIRequestContext> {
    this.contextPromise ??= this.requestFactory();
    return this.contextPromise;
  }

  /** Build an absolute URL from a relative path using the configured baseUrl */
  private buildUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    if (!this.baseUrl) {
      throw new Error(
        "Cannot resolve relative path without a configured baseUrl."
      );
    }
    const normalisedPath = path.replace(/^\//, "");
    if (normalisedPath.length === 0) {
      return this.baseUrl.replace(/\/+$/, "") || this.baseUrl;
    }
    const separator = this.baseUrl.endsWith("/") ? "" : "/";
    return `${this.baseUrl.replace(/\/+$/, "")}${separator}${normalisedPath}`;
  }

  /** Normalise query params object into string map for playwright */
  private buildParams(
    query?: Record<string, QueryParamValue>
  ): Record<string, string> | undefined {
    if (!query) return undefined;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      params[key] = String(value);
    }
    return params;
  }
}

async function safeReadBody(response: APIResponse): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

function parseBody<T>(
  rawBody: string | undefined,
  responseType: ApiRequestOptions["responseType"] = "auto"
): T {
  if (rawBody === undefined || rawBody === "") {
    return undefined as T;
  }

  if (responseType === "text") {
    return rawBody as unknown as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    if (responseType === "json") {
      throw new Error("Failed to parse response body as JSON.");
    }
    return rawBody as unknown as T;
  }
}

export interface ApiAttachmentOptions {
  includeRaw?: boolean;
}

export function buildApiAttachment(
  entry: ApiLogEntry,
  options?: ApiAttachmentOptions
): { name: string; body: string; contentType: string } {
  const includeRaw = options?.includeRaw ?? false;
  const payload = {
    ...entry,
    rawRequest: includeRaw ? entry.rawRequest : undefined,
    rawResponse: includeRaw ? entry.rawResponse : undefined,
  };

  return {
    name: `api-${entry.method.toLowerCase()}-${entry.status}.json`,
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json",
  };
}
