import type { Locator } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { TableUtils } from "../../src/utils/table.utils.js";

type TableSpec = {
  headers: string[];
  rows: string[][];
};

describe("TableUtils.mapTable", () => {
  const utils = new TableUtils();

  it("maps citizen tables into row objects", async () => {
    const table = createTableLocator({
      headers: ["Case reference", "Status"],
      rows: [
        ["  12345  ", "Open"],
        ["67890", "Closed "],
      ],
    });

    const result = await utils.mapCitizenTable(table);

    expect(result).toEqual([
      { "Case reference": "12345", Status: "Open" },
      { "Case reference": "67890", Status: "Closed" },
    ]);
  });

  it("removes EXUI sort icon artefacts from headers", async () => {
    const table = createTableLocator({
      headers: ["Case reference \t▼", "Status \t▼"],
      rows: [["112233", "In Progress"]],
    });

    const result = await utils.mapExuiTable(table);

    expect(result).toEqual([{ "Case reference": "112233", Status: "In Progress" }]);
  });

  it("aligns rows when a leading checkbox has no header", async () => {
    const table = createTableLocator({
      headers: ["Case reference", "Status"],
      rows: [
        ["☐", "12345", "Open"],
        ["☐", "67890", "Closed"],
      ],
    });

    const result = await utils.mapCitizenTable(table);

    expect(result).toEqual([
      { "Case reference": "12345", Status: "Open" },
      { "Case reference": "67890", Status: "Closed" },
    ]);
  });

  it("ignores trailing action columns when they lack headers", async () => {
    const table = createTableLocator({
      headers: ["Case reference", "Status"],
      rows: [
        ["12345", "Open", "View"],
        ["67890", "Closed", "Change"],
      ],
    });

    const result = await utils.mapCitizenTable(table);

    expect(result).toEqual([
      { "Case reference": "12345", Status: "Open" },
      { "Case reference": "67890", Status: "Closed" },
    ]);
  });

  it("skips both leading selection and trailing action cells", async () => {
    const table = createTableLocator({
      headers: ["Case reference", "Status"],
      rows: [
        ["☑", "12345", "Open", "Actions"],
        ["☑", "67890", "Closed", "Actions"],
      ],
    });

    const result = await utils.mapCitizenTable(table);

    expect(result).toEqual([
      { "Case reference": "12345", Status: "Open" },
      { "Case reference": "67890", Status: "Closed" },
    ]);
  });
});

function createTableLocator(spec: TableSpec): Locator {
  const headerLocator = {
    allInnerTexts: async () => [...spec.headers],
  };

  const rowsLocator = {
    count: async () => spec.rows.length,
    nth: (index: number) => createRowLocator(spec.rows[index] ?? []),
  };

  return {
    scrollIntoViewIfNeeded: async () => {},
    locator: (selector: string) => {
      if (selector === "thead tr th") {
        return headerLocator;
      }
      if (selector === "tbody tr") {
        return rowsLocator;
      }
      throw new Error(`Unsupported selector: ${selector}`);
    },
  } as unknown as Locator;
}

function createRowLocator(values: string[]) {
  return {
    locator: (selector: string) => {
      if (selector !== "th, td") {
        throw new Error(`Unsupported selector for row: ${selector}`);
      }
      return createCellsLocator(values);
    },
  };
}

function createCellsLocator(values: string[]) {
  return {
    count: async () => values.length,
    allInnerTexts: async () => [...values],
    nth: (index: number) => ({
      innerText: async () => values[index] ?? "",
    }),
  };
}
