import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCoverageRows,
  formatCoverageText,
  readCoverageSummary,
  type CoverageTotals,
} from "../../src/utils/coverage.utils.js";

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("coverage utils", () => {
  const totals: CoverageTotals = {
    lines: { pct: 81.03, covered: 2294, total: 2831 },
    statements: { pct: 81.03, covered: 2294, total: 2831 },
    functions: { pct: 76.31, covered: 58, total: 76 },
    branches: { pct: 51.36, covered: 225, total: 438 },
  };

  it("formats coverage totals as a text block", () => {
    const text = formatCoverageText(totals);

    expect(text).toBe(
      [
        "Coverage Summary",
        "================",
        "Lines: 81.03% (2294/2831)",
        "Statements: 81.03% (2294/2831)",
        "Functions: 76.31% (58/76)",
        "Branches: 51.36% (225/438)",
      ].join("\n")
    );
  });

  it("reads coverage-summary.json and returns text + totals", () => {
    const dir = makeTmpDir();
    const file = path.join(dir, "coverage-summary.json");
    fs.writeFileSync(file, JSON.stringify({ total: totals }), "utf8");

    const summary = readCoverageSummary(file);

    expect(summary?.totals).toEqual(totals);
    expect(summary?.textSummary).toContain("Coverage Summary");
  });

  it("returns undefined when the file is missing or invalid", () => {
    expect(readCoverageSummary("missing.json")).toBeUndefined();

    const dir = makeTmpDir();
    const badFile = path.join(dir, "coverage-summary.json");
    fs.writeFileSync(badFile, "not-json", "utf8");
    expect(readCoverageSummary(badFile)).toBeUndefined();
  });

  it("builds normalized coverage rows", () => {
    const rows = buildCoverageRows(totals);

    expect(rows).toEqual([
      { metric: "Lines", percent: "81.03%", covered: 2294, total: 2831 },
      { metric: "Statements", percent: "81.03%", covered: 2294, total: 2831 },
      { metric: "Functions", percent: "76.31%", covered: 58, total: 76 },
      { metric: "Branches", percent: "51.36%", covered: 225, total: 438 },
    ]);
  });
});

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-coverage-"));
  tmpDirs.push(dir);
  return dir;
}
