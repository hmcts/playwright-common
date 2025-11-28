import { describe, it, expect } from "vitest";
import { buildApiAttachment, type ApiLogEntry } from "../src/utils/api-client";

// Minimal log entry shape to test attachment building
const sampleEntry: ApiLogEntry = {
  id: "1",
  name: "api-client",
  method: "GET",
  url: "https://example.test/api?token=abc",
  status: 200,
  ok: true,
  timestamp: new Date().toISOString(),
  durationMs: 10,
  request: {
    headers: {
      Authorization: "Bearer xyz",
      "x-xsrf-token": "123",
      Cookie: "a=b",
    },
    data: { password: "p@ss" },
  },
  response: {
    headers: {
      "Set-Cookie": "sid=1",
    },
    body: { token: "xyz" },
  },
  rawRequest: {
    data: { secret: "raw" },
    form: undefined,
  },
  rawResponse: "{\"token\":\"xyz\"}"
};

describe("buildApiAttachment redaction", () => {
  it("excludes raw bodies when includeRaw=false", () => {
    const attachment = buildApiAttachment(sampleEntry, { includeRaw: false });
    const parsed = JSON.parse(attachment.body);
    expect(parsed.rawRequest).toBeUndefined();
    expect(parsed.rawResponse).toBeUndefined();
  });

  it("includes raw bodies when includeRaw=true", () => {
    const attachment = buildApiAttachment(sampleEntry, { includeRaw: true });
    const parsed = JSON.parse(attachment.body);
    expect(parsed.rawRequest).toBeDefined();
    expect(parsed.rawResponse).toBeDefined();
  });
});
