import fs from "node:fs";
import path from "node:path";
import { Project, SyntaxKind, type StringLiteral } from "ts-morph";

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
  /**
   * Use AST parser (ts-morph) for more accurate detection. Falls back to regex when false.
   */
  useAst?: boolean;
};

/**
 * Recursively scans a directory for API client calls and returns endpoint hit counts.
 * Designed for Playwright API tests that use apiClient/anonymousClient/client helpers,
 * but the regex can be overridden for other call shapes.
 */
export function scanApiEndpoints(rootDir: string, options?: EndpointScanOptions): EndpointScanResult {
  if (options?.useAst) {
    try {
      return scanApiEndpointsAst(rootDir, options);
    } catch {
      // fall back to regex scanner silently
    }
  }
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

// AST-based scanner using ts-morph for resilient endpoint extraction
function scanApiEndpointsAst(rootDir: string, options?: EndpointScanOptions): EndpointScanResult {
  const project = new Project({
    // Parse files in folder; do not rely on a tsconfig
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
  });
  const extensions = options?.extensions ?? [".ts", ".js"];
  const files = walk(rootDir, extensions);
  for (const file of files) project.addSourceFileAtPath(file);

  const counts = new Map<string, number>();

  for (const sf of project.getSourceFiles()) {
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      // Match forms like apiClient.get("/path") or client.post("/path")
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;
      const pae = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const objectName = pae.getExpression().getText();
      const methodName = pae.getName();
      if (!/(^apiClient$|^anonymousClient$|^client$)/.test(objectName)) continue;
      if (!/(get|post|put|delete)/.test(methodName)) continue;
      const args = call.getArguments();
      if (!args.length) continue;
      const first = args.at(0);
      if (!first) continue;
      // Accept string literals and template literals without expression interpolation
      let endpoint: string | undefined;
      if (first.getKind() === SyntaxKind.StringLiteral) {
        endpoint = (first as StringLiteral).getLiteralText();
      } else if (first.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
        endpoint = first.getText().slice(1, -1); // remove backticks
      } else {
        continue; // dynamic or complex; skip
      }
      if (!endpoint) continue;
      counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
    }
  }

  const endpoints = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([endpoint, hits]) => ({ endpoint, hits }));
  const totalHits = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  return { endpoints, totalHits };
}

/**
 * Build a Markdown table summarising endpoint hit counts.
 * Accepts either a full scan result or a raw endpoints array + total.
 */
export function formatEndpointHitsMarkdown(result: EndpointScanResult | EndpointHit[], totalHits?: number): string {
  const endpoints = Array.isArray(result) ? result : result.endpoints;
  const total = Array.isArray(result) ? (totalHits ?? endpoints.reduce((s, e) => s + e.hits, 0)) : result.totalHits;
  if (!endpoints.length) {
    return `| Endpoint | Hits |\n|----------|------|\n| (none found) | 0 |\n\nTotal Hits: 0`;
  }
  const header = `| Endpoint | Hits |\n|----------|------|`;
  const rows = endpoints
    .map((e) => `| ${e.endpoint} | ${e.hits} |`)
    .join("\n");
  return `${header}\n${rows}\n\nTotal Hits: ${total}`;
}
