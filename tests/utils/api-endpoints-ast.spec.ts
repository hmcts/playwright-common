import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanApiEndpoints } from "../../src/utils/api-endpoints.utils";

describe("scanApiEndpoints AST mode", () => {
  it("detects only static literal endpoints and counts duplicates", () => {
    const root = path.resolve(process.cwd(), "tests/fixtures/endpoints");
    const result = scanApiEndpoints(root, { useAst: true });

    // Expected endpoints from fixtures (static only)
    // static.ts: /health (twice), /cases, /users/123
    // mixed.ts: /info, /archive/456 (dynamic skipped)
    const expected = [
      { endpoint: "/archive/456", hits: 1 },
      { endpoint: "/cases", hits: 1 },
      { endpoint: "/health", hits: 2 },
      { endpoint: "/info", hits: 1 },
      { endpoint: "/users/123", hits: 1 },
    ];

    expect(result.totalHits).toBe(6);
    expect(result.endpoints).toEqual(expected);
  });
});
