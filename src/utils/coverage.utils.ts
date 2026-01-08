import fs from "node:fs";
import path from "node:path";

export type CoverageMetric = {
  total?: number;
  covered?: number;
  skipped?: number;
  pct?: number;
};

export type CoverageTotals = {
  lines?: CoverageMetric;
  statements?: CoverageMetric;
  functions?: CoverageMetric;
  branches?: CoverageMetric;
};

export type CoverageSummary = {
  totals: CoverageTotals;
  textSummary: string;
};

/**
 * Reads a c8/Istanbul coverage-summary.json and returns totals plus a human-readable summary.
 * Returns undefined if the file does not exist or cannot be parsed.
 * 
 * @param summaryPath - Path to coverage-summary.json file
 * @returns Coverage summary object with totals and text, or undefined if not found
 * 
 * @example
 * ```typescript
 * const summary = readCoverageSummary('./coverage/coverage-summary.json');
 * if (summary) {
 *   console.log(summary.textSummary);
 *   // Coverage Summary
 *   // ================
 *   // Lines: 81.03% (2294/2831)
 *   // ...
 * }
 * ```
 */
export function readCoverageSummary(summaryPath: string): CoverageSummary | undefined {
  const resolved = path.resolve(summaryPath);
  if (!fs.existsSync(resolved)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(resolved, "utf8");
    const json = JSON.parse(raw) as { total?: CoverageTotals };
    const totals = json?.total;
    if (!totals) {
      return undefined;
    }
    return { totals, textSummary: formatCoverageText(totals) };
  } catch (error) {
    // Always log failures - coverage errors should be visible
    const message = `Failed to parse coverage summary at ${resolved}`;
    if (process.env.PWDEBUG === "1" || process.env.PWDEBUG?.toLowerCase() === "true") {
      console.warn(`${message}: ${
        error instanceof Error ? error.message : String(error)
      }`);
    } else {
      console.warn(message);
    }
    return undefined;
  }
}

/**
 * Formats coverage totals into a short, human-readable block suitable for plain-text artifacts.
 */
export function formatCoverageText(totals: CoverageTotals): string {
  const fmt = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "n/a");
  const fmtMetric = (label: string, metric?: CoverageMetric) => {
    const covered = metric?.covered ?? 0;
    const total = metric?.total ?? 0;
    return `${label}: ${fmt(metric?.pct)}% (${covered}/${total})`;
  };

  const lines = [
    "Coverage Summary",
    "================",
    fmtMetric("Lines", totals.lines),
    fmtMetric("Statements", totals.statements),
    fmtMetric("Functions", totals.functions),
    fmtMetric("Branches", totals.branches),
  ];

  return lines.join("\n");
}

export type CoverageRow = {
  metric: string;
  percent: string;
  covered: number;
  total: number;
};

/**
 * Produces normalized table rows that consumers can render into HTML or Markdown tables.
 * 
 * @param totals - Coverage totals from coverage-summary.json
 * @returns Array of coverage rows ready for table rendering
 * 
 * @example
 * ```typescript
 * const summary = readCoverageSummary('./coverage/coverage-summary.json');
 * if (summary) {
 *   const rows = buildCoverageRows(summary.totals);
 *   // [
 *   //   { metric: 'Lines', percent: '81.03%', covered: 2294, total: 2831 },
 *   //   ...
 *   // ]
 *   // Render to HTML table, Markdown, or JSON artifact
 * }
 * ```
 */
export function buildCoverageRows(totals: CoverageTotals): CoverageRow[] {
  const fmt = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "n/a");
  const buildRow = (label: string, metric?: CoverageMetric): CoverageRow => ({
    metric: label,
    percent: `${fmt(metric?.pct)}%`,
    covered: metric?.covered ?? 0,
    total: metric?.total ?? 0,
  });

  return [
    buildRow("Lines", totals.lines),
    buildRow("Statements", totals.statements),
    buildRow("Functions", totals.functions),
    buildRow("Branches", totals.branches),
  ];
}
