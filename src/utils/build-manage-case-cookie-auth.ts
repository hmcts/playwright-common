// src/utils/build-manage-case-cookie-auth.ts
//
// Builds headers to call Manage Case `/data/...` endpoints using Playwright storageState cookies.
// Mirrors the browser request closely to avoid CSRF/session middleware issues.
//
// Adds:
// - Cookie
// - x-xsrf-token (from XSRF-TOKEN cookie on the manage-case host)
// - experimental: true
// - client-context (defaults to en)
// - Origin / Referer (defaults on)
// - request-id / traceparent (defaults on; generated)
// - accept-language (defaults to browser-like value)

import crypto from "node:crypto";

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path?: string;
};

export type PlaywrightStorageState = {
  cookies: StoredCookie[];
  origins?: Array<{
    origin: string;
    localStorage?: Array<{ name: string; value: string }>;
  }>;
};

export interface BuildManageCaseCookieAuthOptions {
  /**
   * Hostname for Manage Case, e.g. "manage-case.aat.platform.hmcts.net".
   * Prefer deriving from config: new URL(config.urls.manageCaseBaseUrl).host
   */
  host: string;

  /** Default: true */
  experimental?: boolean;

  /** Default: English language context */
  clientContext?: string;

  /** Default: "XSRF-TOKEN" */
  xsrfCookieName?: string;

  /** Default: false (include all cookies for the host) */
  minimalCookieSet?: boolean;

  /** Default: true */
  includeOriginAndReferer?: boolean;

  /** Default: "https" */
  scheme?: "https" | "http";

  /** Default: true */
  includeTracingHeaders?: boolean;

  /** Default: "en-GB,en-US;q=0.9,en;q=0.8" */
  acceptLanguage?: string;
}

export interface ManageCaseCookieAuthHeaders {
  Cookie: string;
  "x-xsrf-token": string;

  experimental?: string;
  "client-context"?: string;

  Origin?: string;
  Referer?: string;

  "request-id"?: string;
  traceparent?: string;

  "accept-language"?: string;
}

const DEFAULT_CLIENT_CONTEXT_EN =
  "eyJjbGllbnRfY29udGV4dCI6eyJ1c2VyX2xhbmd1YWdlIjp7Imxhbmd1YWdlIjoiZW4ifX19";

const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en-US;q=0.9,en;q=0.8";

function normaliseDomain(domain: string): string {
  // Playwright sometimes stores leading dot domains; normalise so ".example.com" matches "example.com"
  return domain.startsWith(".") ? domain.slice(1) : domain;
}

export function buildManageCaseCookieAuth(
  storageState: PlaywrightStorageState,
  options: BuildManageCaseCookieAuthOptions,
): ManageCaseCookieAuthHeaders {
  if (!storageState?.cookies || !Array.isArray(storageState.cookies)) {
    throw new Error("Invalid storageState: expected an object with a cookies array.");
  }
  if (!options?.host) {
    throw new Error("Missing required option: host");
  }

  const host = options.host;
  const xsrfCookieName = options.xsrfCookieName ?? "XSRF-TOKEN";

  const hostCookies = storageState.cookies.filter((c) => normaliseDomain(c.domain) === host);

  if (hostCookies.length === 0) {
    throw new Error(`No cookies found for host '${host}'. Check you are loading the correct storageState.`);
  }

  const xsrfToken = hostCookies.find((c) => c.name === xsrfCookieName)?.value;
  if (!xsrfToken) {
    throw new Error(`Cookie '${xsrfCookieName}' not found for host '${host}'. Cannot build x-xsrf-token header.`);
  }

  const allowList = new Set([
    "xui-webapp",
    "__auth__",
    "__userid__",
    xsrfCookieName,
    "exui-preferred-language",
    // sometimes present; harmless if missing:
    "hmcts-exui-cookies-accepted",
    "hmcts-exui-cookies-analytics",
    // some setups also use JSESSIONID:
    "JSESSIONID",
  ]);

  const cookiesForHeader = (
    options.minimalCookieSet ? hostCookies.filter((c) => allowList.has(c.name)) : hostCookies
  ).sort((a, b) => a.name.localeCompare(b.name));

  const cookieHeader = cookiesForHeader.map((c) => `${c.name}=${c.value}`).join("; ");

  const headers: ManageCaseCookieAuthHeaders = {
    Cookie: cookieHeader,
    "x-xsrf-token": xsrfToken,
  };

  const experimental = options.experimental ?? true;
  if (experimental) {
    headers.experimental = "true";
  }

  const clientContext = options.clientContext ?? DEFAULT_CLIENT_CONTEXT_EN;
  if (clientContext) {
    headers["client-context"] = clientContext;
  }

  const includeOriginAndReferer = options.includeOriginAndReferer ?? true;
  if (includeOriginAndReferer) {
    const scheme = options.scheme ?? "https";
    headers.Origin = `${scheme}://${host}`;
    headers.Referer = `${scheme}://${host}/`;
  }

  const includeTracingHeaders = options.includeTracingHeaders ?? true;
  if (includeTracingHeaders) {
    // Match the structure seen in browser calls:
    // request-id: |<32hex>.<16hex>
    const traceId = randomHex(16); // 16 bytes -> 32 hex chars
    const parentId = randomHex(8); // 8 bytes  -> 16 hex chars
    headers["request-id"] = `|${traceId}.${parentId}`;
    headers.traceparent = `00-${traceId}-${parentId}-01`;
  }

  const acceptLanguage = options.acceptLanguage ?? DEFAULT_ACCEPT_LANGUAGE;
  if (acceptLanguage) {
    headers["accept-language"] = acceptLanguage;
  }

  return headers;
}