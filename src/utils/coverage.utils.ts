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
  } catch {
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
