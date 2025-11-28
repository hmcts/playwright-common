import fs from "node:fs";
import path from "node:path";

export type EndpointHit = {
  endpoint: string;
  hits: number;
};

export type EndpointScanResult = {
  endpoints: EndpointHit[];
  totalHits: number;
};

export type EndpointScanOptions = {
  /**
   * Override the regex used to find API calls. The endpoint value is read from the
   * capture group defined by `endpointGroup`.
   */
  callPattern?: RegExp;
  /**
   * Which capture group of the regex represents the endpoint path. Defaults to 3,
   * matching the bundled pattern: /\b(apiClient|anonymousClient|client)\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
   */
  endpointGroup?: number;
  /**
   * File extensions to scan. Defaults to .ts and .js.
   */
  extensions?: string[];
};

/**
 * Recursively scans a directory for API client calls and returns endpoint hit counts.
 * Designed for Playwright API tests that use apiClient/anonymousClient/client helpers,
 * but the regex can be overridden for other call shapes.
 */
export function scanApiEndpoints(rootDir: string, options?: EndpointScanOptions): EndpointScanResult {
  const pattern =
    options?.callPattern ??
    /\b(apiClient|anonymousClient|client)\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const endpointGroup = options?.endpointGroup ?? 3;
  const extensions = options?.extensions ?? [".ts", ".js"];

  const files = walk(rootDir, extensions);
  const counts = new Map<string, number>();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const endpoint = match[endpointGroup];
      if (!endpoint) {
        continue;
      }
      counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
    }
  }

  const endpoints = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([endpoint, hits]) => ({ endpoint, hits }));

  const totalHits = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  return { endpoints, totalHits };
}

function walk(rootDir: string, extensions: string[]): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full, extensions));
    } else if (entry.isFile() && extensions.some((ext) => full.endsWith(ext))) {
      files.push(full);
    }
  }

  return files;
}
