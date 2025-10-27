import { describe, expect, it } from "vitest";
import {
  REDACTED_VALUE,
  buildRedactionState,
  redactString,
  sanitizeUrl,
  sanitizeValue,
} from "../../src/logging/redaction.js";

describe("redaction utilities", () => {
  const state = buildRedactionState();

  it("redacts object properties with sensitive keys", () => {
    const payload = {
      token: "abc123",
      nested: {
        secret: "top-secret",
        harmless: "value",
      },
    };

    const result = sanitizeValue(payload, state);

    expect(result.token).toBe(REDACTED_VALUE);
    expect(result.nested.secret).toBe(REDACTED_VALUE);
    expect(result.nested.harmless).toBe("value");
  });

  it("redacts bearer tokens inside strings", () => {
    const message = "Authorization: Bearer some-super-secret-token";
    const result = redactString(message);
    expect(result).toContain(REDACTED_VALUE);
  });

  it("redacts sensitive query parameters in URLs", () => {
    const url =
      "https://example.com/path?token=secret-token&other=value&password=123";
    const sanitized = sanitizeUrl(url, state);
    expect(sanitized).toContain(`token=${encodeURIComponent(REDACTED_VALUE)}`);
    expect(sanitized).toContain(
      `password=${encodeURIComponent(REDACTED_VALUE)}`
    );
    expect(sanitized).toContain("other=value");
  });

  it("handles circular references without throwing", () => {
    const payload: Record<string, unknown> = {
      password: "secret",
      nested: {
        token: "abc123",
      },
    };
    payload.self = payload;

    const result = sanitizeValue(payload, state);

    expect(result.password).toBe(REDACTED_VALUE);
    expect(result.nested).toEqual({ token: REDACTED_VALUE });
    expect(result.self).toBe("[Circular]");
  });

  it("leaves dates untouched while masking sensitive siblings", () => {
    const now = new Date();
    const payload = {
      timestamp: now,
      secretKey: "should-hide",
    };

    const result = sanitizeValue(payload, state);

    expect(result.timestamp).toBe(now.toISOString());
    expect(result.secretKey).toBe(REDACTED_VALUE);
  });

  it("redacts tokens in arrays", () => {
    const payload = [
      { token: "abc" },
      { nested: [{ password: "pw" }] },
      "Bearer abc",
    ];

    const result = sanitizeValue(payload, state);

    expect(result[0]).toEqual({ token: REDACTED_VALUE });
    expect(result[1]).toEqual({ nested: [{ password: REDACTED_VALUE }] });
    expect(result[2]).toContain(REDACTED_VALUE);
  });
});
