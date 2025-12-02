import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanApiEndpoints } from "../../src/utils/api-endpoints.utils.js";

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("scanApiEndpoints", () => {
  it("counts api client calls across nested files", () => {
    const root = makeTmpDir();
    write(
      root,
      "api/first.spec.ts",
      `
        await apiClient.get("/cases");
        await apiClient.post("/cases");
        await anonymousClient.get("/cases");
      `
    );
    write(
      root,
      "api/nested/other.spec.ts",
      `
        await client.delete("/role-access");
        await client.delete("/role-access");
      `
    );

    const result = scanApiEndpoints(root);

    expect(result.totalHits).toBe(5);
    expect(result.endpoints).toEqual([
      { endpoint: "/cases", hits: 3 },
      { endpoint: "/role-access", hits: 2 },
    ]);
  });

  it("returns an empty result when the folder is missing", () => {
    const result = scanApiEndpoints("/tmp/does-not-exist");
    expect(result).toEqual({ endpoints: [], totalHits: 0 });
  });

  it("supports custom patterns and extensions", () => {
    const root = makeTmpDir();
    write(root, "api/raw.js", `callApi("custom-path"); callApi("custom-path");`);

    const result = scanApiEndpoints(root, {
      callPattern: /callApi\(["']([^"']+)["']\)/g,
      endpointGroup: 1,
      extensions: [".js"],
    });

    expect(result.endpoints).toEqual([{ endpoint: "custom-path", hits: 2 }]);
    expect(result.totalHits).toBe(2);
  });
});

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-endpoints-"));
  tmpDirs.push(dir);
  return dir;
}

function write(root: string, relativePath: string, content: string) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}
