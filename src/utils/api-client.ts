import { APIRequestContext, APIResponse, request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Logger } from "winston";
import {
  buildRedactionState,
  sanitiseHeaders,
  sanitiseUrl,
  sanitiseValue,
  type RedactPattern,
  type RedactionState,
} from "../logging/redaction.js";
import { createLogger } from "../logging/logger.js";

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

  constructor(message: string, status: number, logEntry: ApiLogEntry) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.logEntry = logEntry;
  }
}

/**
 * Lightweight HTTP client wrapper around Playwright's APIRequestContext.
 * Provides redacted structured logging, correlation IDs and optional raw body capture.
 */
export class ApiClient {
  private readonly baseUrl?: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly requestFactory: () => Promise<APIRequestContext>;
  private readonly logger: Logger;
  private readonly name: string;
  private readonly redactionState: RedactionState;
  private readonly captureRawBodies: boolean;
  private readonly globalCorrelationId?: string;
  private readonly onResponse?: (entry: ApiLogEntry) => void;
  private contextPromise?: Promise<APIRequestContext>;

  constructor(options?: ApiClientOptions) {
    this.baseUrl = options?.baseUrl;
    this.defaultHeaders = { ...(options?.defaultHeaders ?? {}) };
    this.requestFactory =
      options?.requestFactory ?? (() => request.newContext());
    this.name = options?.name ?? "api-client";
    this.logger =
      options?.logger ??
      createLogger({
        serviceName: options?.loggerOptions?.serviceName ?? this.name,
        level: options?.loggerOptions?.level,
        format: options?.loggerOptions?.format,
      });
    this.redactionState = buildRedactionState({
      enabled: options?.redaction?.enabled,
      patterns: options?.redaction?.patterns,
    });
    const debugBodies =
      process.env.PLAYWRIGHT_DEBUG_API === "1" ||
      process.env.PLAYWRIGHT_DEBUG_API?.toLowerCase() === "true";
    this.captureRawBodies = options?.captureRawBodies ?? debugBodies;
    this.globalCorrelationId = options?.correlationId;
    this.onResponse = options?.onResponse;
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
    const context = await this.getContext();
    const requestHeaders = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    const url = this.buildUrl(path);
    const correlationId =
      options?.correlationId ?? this.globalCorrelationId ?? randomUUID();
    const startTime = Date.now();

    const response = await context.fetch(url, {
      method,
      headers: requestHeaders,
      data: options?.data,
      form: options?.form,
      params: this.buildParams(options?.query),
      timeout: options?.timeoutMs,
    });

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
    const sanitisedRequestData = sanitiseValue(
      options?.data,
      this.redactionState
    );
    const sanitisedForm = sanitiseValue(options?.form, this.redactionState);
    const sanitisedQuery = sanitiseValue(options?.query, this.redactionState);
    const sanitisedResponseBody = sanitiseValue(
      parsedBody,
      this.redactionState,
      "responseBody"
    );

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
      request: {
        headers: sanitisedRequestHeaders,
        data: sanitisedRequestData,
        form: sanitisedForm,
        query: sanitisedQuery,
      },
      response: {
        headers: sanitisedResponseHeaders,
        body: sanitisedResponseBody,
      },
      rawRequest: this.captureRawBodies
        ? {
            data: options?.data,
            form: options?.form,
          }
        : undefined,
      rawResponse: this.captureRawBodies ? rawBody : undefined,
    };

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
      throw new ApiClientError(
        `Request failed with status ${status}`,
        status,
        logEntry
      );
    }

    return {
      ok,
      status,
      data: parsedBody,
      logEntry,
      headers: responseHeaders,
      rawBody: this.captureRawBodies ? rawBody : undefined,
    };
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
