import { URL } from "url";

export const REDACTED_VALUE = "[REDACTED]";
const CIRCULAR_PLACEHOLDER = "[Circular]";
const NON_PLAIN_OBJECT_PLACEHOLDER = "[Object]";

export type RedactPattern = string | RegExp;

const TOKEN_TEXT_REGEX = /(Bearer\s+)([A-Za-z0-9\-._]+)/gi;
const KEY_VALUE_SECRET_REGEX =
  /((?:token|secret|password|api[_-]?key)[^:=]*)([:=]\s*)(["']?)([^"'\s]+)/gi;

const DEFAULT_PATTERNS: RegExp[] = [
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /api[-_]?key/i,
];

export interface RedactionState {
  enabled: boolean;
  patterns: RegExp[];
}

export interface RedactionOptions {
  enabled?: boolean;
  patterns?: RedactPattern[];
}

export interface SanitisedUrl {
  original: string;
  redacted: string;
}

export const SPLAT_SYMBOL = Symbol.for("splat");

export function buildRedactionState(
  options?: RedactionOptions
): RedactionState {
  const enabled = options?.enabled ?? true;
  const patterns = options?.patterns?.length
    ? options.patterns.map((pattern) =>
        typeof pattern === "string" ? new RegExp(pattern, "i") : pattern
      )
    : DEFAULT_PATTERNS;
  return { enabled, patterns };
}

export function shouldRedactKey(
  key: string | undefined,
  state: RedactionState
): boolean {
  if (!state.enabled || !key) return false;
  return state.patterns.some((pattern) => pattern.test(key));
}

export function sanitizeValue<T>(
  value: T,
  state: RedactionState,
  key?: string
): T {
  if (!state.enabled) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (shouldRedactKey(key, state)) {
    return REDACTED_VALUE as unknown as T;
  }

  if (typeof value === "string") {
    return redactString(value) as unknown as T;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const seen = new WeakSet<object>();

  try {
    const json = JSON.stringify(value, (currentKey, currentValue) => {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }

      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue)) {
          return CIRCULAR_PLACEHOLDER;
        }
        seen.add(currentValue);
      }

      if (shouldRedactKey(currentKey, state)) {
        return REDACTED_VALUE;
      }

      if (typeof currentValue === "string") {
        return redactString(currentValue);
      }

      return currentValue;
    });

    if (json === undefined) {
      return NON_PLAIN_OBJECT_PLACEHOLDER as unknown as T;
    }

    return JSON.parse(json) as T;
  } catch {
    return NON_PLAIN_OBJECT_PLACEHOLDER as unknown as T;
  }
}

export function sanitizeRecord(
  record: Record<string | symbol, unknown>,
  state: RedactionState
): Record<string | symbol, unknown> {
  const sanitized: Record<string | symbol, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = sanitizeValue(value, state, key);
  }
  for (const sym of Object.getOwnPropertySymbols(record)) {
    sanitized[sym] = sanitizeValue(record[sym], state);
  }
  return sanitized;
}

export function sanitizeHeaders(
  headers: Record<string, string> | undefined,
  state: RedactionState
): Record<string, string> | undefined {
  if (!headers) return headers;
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    entries[key] = sanitizeValue(value, state, key);
  }
  return entries;
}

export function sanitizeUrl(url: string, state: RedactionState): string {
  if (!state.enabled) return url;
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (shouldRedactKey(key, state)) {
        parsed.searchParams.set(key, REDACTED_VALUE);
      } else {
        const currentValue = parsed.searchParams.get(key);
        if (currentValue) {
          parsed.searchParams.set(key, redactString(currentValue));
        }
      }
    }
    return parsed.toString();
  } catch {
    return redactString(url);
  }
}

export function redactString(value: string): string {
  return value
    .replace(TOKEN_TEXT_REGEX, "$1" + REDACTED_VALUE)
    .replace(KEY_VALUE_SECRET_REGEX, "$1$2$3" + REDACTED_VALUE);
}
