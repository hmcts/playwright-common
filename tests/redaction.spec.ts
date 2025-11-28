import { describe, it, expect } from "vitest";
import { buildRedactionState, sanitiseHeaders, sanitiseValue, REDACTED_VALUE } from "../src/logging/redaction";

describe("redaction defaults", () => {
  const state = buildRedactionState();

  it("masks common sensitive headers including xsrf and cookies", () => {
    const headers = sanitiseHeaders(
      {
        Authorization: "Bearer abc.def.ghi",
        "x-xsrf-token": "12345",
        Cookie: "sessionid=abc; other=value",
        "Set-Cookie": "sessionid=abc; HttpOnly",
        "X-API-Key": "my-key",
        Accept: "application/json",
      },
      state
    )!;

    expect(headers.Authorization).toContain(REDACTED_VALUE);
    expect(headers["x-xsrf-token"]).toBe(REDACTED_VALUE);
    expect(headers.Cookie).toBe(REDACTED_VALUE);
    expect(headers["Set-Cookie"]).toBe(REDACTED_VALUE);
    expect(headers["X-API-Key"]).toBe(REDACTED_VALUE);
    expect(headers.Accept).toBe("application/json");
  });

  it("redacts nested objects by key and string content", () => {
    const payload = {
      password: "secret123",
      token: "Bearer abc.def",
      nested: { api_key: "xyz", normal: "hello" },
    };
    const sanitised = sanitiseValue(payload, state);
    expect(sanitised.password).toBe(REDACTED_VALUE);
    expect(String(sanitised.token)).toContain(REDACTED_VALUE);
    expect(sanitised.nested.api_key).toBe(REDACTED_VALUE);
    expect(sanitised.nested.normal).toBe("hello");
  });
});
