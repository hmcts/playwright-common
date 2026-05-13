import { describe, expect, it, vi } from "vitest";
import type { Locator, Page } from "@playwright/test";
import { TableUtils } from "../../src/utils/table.utils.js";
import {
  createMockPage,
  createMockLocator,
  createMockDataTable,
  createMockDataTableWithHeaderRows,
  createWorkAllocationLocator,
  createMockDataTableWithActualTheadRows,
  createWorkAllocationLocatorWithHiddenRows,
  createMockDataTableWithCheckboxes,
} from "./table.utils.test-helpers.js";

describe("TableUtils - New Methods", () => {
  const utils = new TableUtils();

  describe("parseKeyValueTable", () => {
    it("parses 2-column key-value tables with string selector", async () => {
      const mockPage = createMockPage([
        ["Case Reference", "1234567890123456"],
        ["Status", "Open"],
      ]);

      const result = await utils.parseKeyValueTable("#case-details", mockPage);

      expect(result).toEqual({
        "Case Reference": "1234567890123456",
        Status: "Open",
      });
    });

    it("parses with Locator (no page required)", async () => {
      const mockLocator = createMockLocator([
        ["Applicant", "John Doe"],
        ["Case Type", "Divorce"],
      ]);

      const result = await utils.parseKeyValueTable(mockLocator);

      expect(result).toEqual({
        Applicant: "John Doe",
        "Case Type": "Divorce",
      });
    });

    it("removes sort icons from keys", async () => {
      const mockPage = createMockPage([
        ["Case Reference\t▼", "12345"],
        ["Status ▲", "Open"],
      ]);

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({
        "Case Reference": "12345",
        Status: "Open",
      });
    });

    it("joins multi-column values with spaces", async () => {
      const mockPage = createMockPage([
        ["Name", "John", "Doe"],
        ["Address", "123", "Main St", "London"],
      ]);

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({
        Name: "John Doe",
        Address: "123 Main St London",
      });
    });

    it("skips rows with fewer than 2 cells", async () => {
      const mockPage = createMockPage([
        ["Invalid"],
        ["Case Reference", "12345"],
        [],
      ]);

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({
        "Case Reference": "12345",
      });
    });

    it("throws when page not provided for string selector", async () => {
      await expect(
        utils.parseKeyValueTable("#table")
      ).rejects.toThrow("Page instance required for string selectors");
    });

    it("throws when selector string is empty", async () => {
      await expect(
        utils.parseKeyValueTable("", createMockPage([["Key", "Value"]]))
      ).rejects.toThrow("Selector cannot be empty");
    });

    it("filters out hidden rows", async () => {
      const mockPage = {
        $$eval: vi.fn().mockImplementation((selector: string, fn: (rows: Element[]) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockImplementation((el: HTMLElement) => {
            // Mock: rows with "hidden-row" class are hidden
            if (el.className?.includes("hidden-row")) {
              return { display: "none", visibility: "visible" };
            }
            return { display: "block", visibility: "visible" };
          });

          try {
            const visibleRow = {
              querySelectorAll: () => [
                { innerText: "Case Reference", textContent: "Case Reference" },
                { innerText: "12345", textContent: "12345" }
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              className: ""
            };

            const hiddenRow = {
              querySelectorAll: () => [
                { innerText: "Hidden", textContent: "Hidden" },
                { innerText: "Should not appear", textContent: "Should not appear" }
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              className: "hidden-row"
            };

            const mockRows = [visibleRow, hiddenRow];
            return fn(mockRows as unknown as Element[]);
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Page;

      const result = await utils.parseKeyValueTable("#table", mockPage);

      // Should only include visible row
      expect(result).toEqual({
        "Case Reference": "12345",
      });
      expect(result["Hidden"]).toBeUndefined();
    });

    it("skips aria-hidden rows", async () => {
      const mockPage = createMockPage(
        [
          ["Case Reference", "12345"],
          ["Hidden Key", "Hidden Value"],
        ],
        { ariaHiddenRows: [1] }
      );

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({
        "Case Reference": "12345",
      });
    });

    it("treats rows without computed styles as hidden", async () => {
      const mockPage = {
        $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockReturnValue(null);

          try {
            const row = {
              querySelectorAll: () => [
                { innerText: "Case Reference", textContent: "Case Reference" },
                { innerText: "12345", textContent: "12345" }
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              className: ""
            };

            return fn([row] as unknown as Element[]);
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Page;

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({});
    });

    it("allows empty value cells (returns empty string)", async () => {
      // CRITICAL REGRESSION TEST: empty value cells should not throw
      const mockPage = createMockPage([
        ["Case Reference", "12345"],
        ["Status", ""], // Empty value cell - should be allowed
        ["Notes", ""],  // Another empty value
      ]);

      const result = await utils.parseKeyValueTable("#table", mockPage);

      expect(result).toEqual({
        "Case Reference": "12345",
        Status: "",     // Empty string, not thrown error
        Notes: "",
      });
    });

    it("throws when key cell is empty (keys must have content)", async () => {
      const mockPage = createMockPage([
        ["", "Some value"], // Empty key - should throw
      ]);

      await expect(
        utils.parseKeyValueTable("#table", mockPage)
      ).rejects.toThrow("Failed to extract text from visible key cell");
    });
  });

  describe("parseDataTable", () => {
    it("throws when selector string is empty", async () => {
      await expect(
        utils.parseDataTable("", createMockDataTable({ hasThead: true, headers: ["Name"], rows: [["Alice"]] }))
      ).rejects.toThrow("Selector cannot be empty");
    });

    it("parses tables with thead headers", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name", "Email", "Role"],
        rows: [
          ["Alice", "alice@example.com", "Admin"],
          ["Bob", "bob@example.com", "User"],
        ],
      });

      const result = await utils.parseDataTable("#users-table", mockPage);

      expect(result).toEqual([
        { Name: "Alice", Email: "alice@example.com", Role: "Admin" },
        { Name: "Bob", Email: "bob@example.com", Role: "User" },
      ]);
    });

    it("does NOT include thead rows as data when using full table selector", async () => {
      // CRITICAL REGRESSION TEST: thead rows must be filtered out
      const mockPage = createMockDataTableWithActualTheadRows({
        theadRows: [["Name", "Email", "Role"]], // <thead><tr> rows
        tbodyRows: [
          ["Alice", "alice@example.com", "Admin"],
          ["Bob", "bob@example.com", "User"],
        ],
      });

      const result = await utils.parseDataTable("#users-table", mockPage);

      // Should only have 2 data rows, NOT 3 (must exclude thead row)
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { Name: "Alice", Email: "alice@example.com", Role: "Admin" },
        { Name: "Bob", Email: "bob@example.com", Role: "User" },
      ]);
      
      // Verify header row "Name,Email,Role" is NOT in results
      const hasHeaderRow = result.some(row => 
        row.Name === "Name" && row.Email === "Email" && row.Role === "Role"
      );
      expect(hasHeaderRow).toBe(false);
    });

    it("uses first row as headers when no thead", async () => {
      const mockPage = createMockDataTable({
        hasThead: false,
        headers: ["Application.pdf", "2025-01-01"],  // First row becomes headers
        headerRowUsesTh: true,
        rows: [
          ["Evidence.docx", "2025-01-15"],  // Only remaining data rows
        ],
      });

      const result = await utils.parseDataTable("#docs", mockPage);

      // First row becomes headers, so only second data row is returned
      expect(result).toEqual([
        { "Application.pdf": "Evidence.docx", "2025-01-01": "2025-01-15" },
      ]);
    });

    it("keeps first row as data when header cells are not th", async () => {
      const mockPage = createMockDataTable({
        hasThead: false,
        headers: ["Application.pdf", "2025-01-01"],
        headerRowUsesTh: false,
        rows: [
          ["Evidence.docx", "2025-01-15"],
        ],
      });

      const result = await utils.parseDataTable("#docs", mockPage);

      expect(result).toEqual([
        { column_1: "Application.pdf", column_2: "2025-01-01" },
        { column_1: "Evidence.docx", column_2: "2025-01-15" },
      ]);
    });

    it("ignores rows from nested tables", async () => {
      const mockPage = {
        $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
            display: "block",
            visibility: "visible",
          });

          try {
            const outerTable = { querySelector: () => null };
            const nestedTable = { querySelector: () => null };
            const headerCells = [
              { innerText: "Name", textContent: "Name", colSpan: 1, rowSpan: 1 },
            ];

            const headerRow = {
              querySelectorAll: (sel: string) => {
                if (sel === "th, td" || sel === "th") return headerCells;
                return [];
              },
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              closest: (sel: string) => (sel === "table" ? outerTable : null),
            };

            const nestedRow = {
              querySelectorAll: () => [
                { innerText: "Nested", textContent: "Nested" },
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              closest: (sel: string) => (sel === "table" ? nestedTable : null),
            };

            const dataRow = {
              querySelectorAll: () => [
                { innerText: "Alice", textContent: "Alice" },
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              closest: (sel: string) => (sel === "table" ? outerTable : null),
            };

            return fn([headerRow, nestedRow, dataRow] as unknown as Element[]);
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Page;

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Alice" },
      ]);
    });

    it("merges multi-row headers with colspans and rowspans", async () => {
      const mockPage = createMockDataTableWithHeaderRows({
        headerRows: [
          [
            { text: "Hearing", colSpan: 2 },
            { text: "Judge", rowSpan: 2 },
          ],
          [
            { text: "Date" },
            { text: "Time" },
          ],
        ],
        rows: [["01 Jan 2025", "10:00", "Smith"]],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        {
          "Hearing Date": "01 Jan 2025",
          "Hearing Time": "10:00",
          "Judge": "Smith",
        },
      ]);
    });

    it("generates column_N fallback keys for missing headers", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name", ""], // Second header empty
        rows: [["Alice", "alice@example.com"]],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Alice", column_2: "alice@example.com" },
      ]);
    });

    it("treats zero-width headers as empty and uses fallback keys", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["\u200B", "Status"],
        rows: [["Value", "Open"]],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { column_1: "Value", Status: "Open" },
      ]);
    });

    it("handles empty tables gracefully", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: [],
        rows: [],
      });

      const result = await utils.parseDataTable("#empty", mockPage);

      expect(result).toEqual([]);
    });

    it("skips aria-hidden rows", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name"],
        rows: [["Visible"], ["Hidden"]],
        ariaHiddenRows: [1],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Visible" },
      ]);
    });

    it("filters rows when computed styles are unavailable", async () => {
      const mockPage = {
        $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockReturnValue(null);

          try {
            const headerRow = {
              querySelectorAll: () => [
                { innerText: "Name", textContent: "Name", colSpan: 1, rowSpan: 1 },
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              closest: () => null,
            };

            const thead = {
              querySelectorAll: () => [headerRow],
            };

            const table = {
              querySelector: (sel: string) => (sel === "thead" ? thead : null),
            };

            const row = {
              querySelectorAll: () => [
                { innerText: "Name", textContent: "Name" },
                { innerText: "Alice", textContent: "Alice" },
              ],
              hidden: false,
              hasAttribute: () => false,
              getClientRects: () => [{}],
              closest: (sel: string) => (sel === "table" ? table : null),
            };

            return fn([row] as unknown as Element[]);
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Page;

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([]);
    });

    it("removes sort icons from headers", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name ▼", "Email ▲"],
        rows: [["Alice", "alice@example.com"]],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Alice", Email: "alice@example.com" },
      ]);
    });

    it("cleans whitespace in cell values", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name", "Status"],
        rows: [["  Alice  \n\n  Smith  ", "  Active  "]],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Alice Smith", Status: "Active" },
      ]);
    });

    it("handles tables with selection checkboxes in first column", async () => {
      // CRITICAL: Tables with checkboxes in first column should have text extracted, not ignored
      const mockPage = createMockDataTableWithCheckboxes({
        hasThead: true,
        headers: ["", "Name", "Email"], // First header empty (checkbox column)
        rows: [
          { cells: ["☐", "Alice", "alice@example.com"], hasCheckbox: true },
          { cells: ["☐", "Bob", "bob@example.com"], hasCheckbox: true },
        ],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      // Checkbox columns show as empty text or checkbox symbol
      expect(result).toEqual([
        { column_1: "☐", Name: "Alice", Email: "alice@example.com" },
        { column_1: "☐", Name: "Bob", Email: "bob@example.com" },
      ]);
    });

    it("handles tables with action buttons in last column", async () => {
      // Tables with action buttons should extract button text
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: ["Name", "Status", "Actions"],
        rows: [
          ["Alice", "Active", "Edit"],
          ["Bob", "Inactive", "View"],
        ],
      });

      const result = await utils.parseDataTable("#table", mockPage);

      expect(result).toEqual([
        { Name: "Alice", Status: "Active", Actions: "Edit" },
        { Name: "Bob", Status: "Inactive", Actions: "View" },
      ]);
    });
  });

  describe("parseWorkAllocationTable", () => {
    it("throws when table locator is null", async () => {
      await expect(
        utils.parseWorkAllocationTable(null as unknown as Locator)
      ).rejects.toThrow("tableLocator cannot be null or undefined");
    });

    it("extracts headers from buttons in th elements", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: true },
          { text: "Assignee", hasButton: true },
        ],
        rows: [
          [{ text: "Review", hasLink: false }, { text: "Alice", hasLink: false }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("derives headers from the first body row when thead is missing", async () => {
      const mockLocator = createWorkAllocationLocator({
        hasThead: false,
        headers: [
          { text: "Task", hasButton: false },
          { text: "Assignee", hasButton: false },
        ],
        headerRowUsesTh: true,
        rows: [
          [{ text: "Review", hasLink: false }, { text: "Alice", hasLink: false }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("keeps first row as data when header cells are not th", async () => {
      const mockLocator = createWorkAllocationLocator({
        hasThead: false,
        headerRowUsesTh: false,
        headers: [
          { text: "First Task", hasButton: false },
          { text: "First Assignee", hasButton: false },
        ],
        rows: [
          [{ text: "Review", hasLink: false }, { text: "Alice", hasLink: false }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { column_1: "First Task", column_2: "First Assignee" },
        { column_1: "Review", column_2: "Alice" },
      ]);
    });

    it("extracts text from links in cells", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Case", hasButton: false },
          { text: "Action", hasButton: false },
        ],
        rows: [
          [{ text: "12345", hasLink: true }, { text: "View", hasLink: true }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Case: "12345", Action: "View" },
      ]);
    });

    it("skips aria-hidden rows", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [{ text: "Task", hasButton: false }],
        rows: [
          [{ text: "Visible Task", hasLink: false }],
          [{ text: "Hidden Task", hasLink: false, ariaHidden: true }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Visible Task" },
      ]);
    });

    it("handles empty headers gracefully", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [{ text: "", hasButton: false }],
        rows: [[{ text: "Value", hasLink: false }]],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      // Empty header now gets column_1 fallback (this is correct!)
      expect(result).toEqual([{ column_1: "Value" }]);
    });

    it("removes sort icons from headers and cells", async () => {
      // CRITICAL REGRESSION TEST: sort icons must be removed
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task ▼", hasButton: true },
          { text: "Priority ▲", hasButton: false },
        ],
        rows: [
          [{ text: "Review ↓", hasLink: false }, { text: "High ↑", hasLink: false }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      // Sort icons should be stripped from headers
      expect(result[0]).toHaveProperty("Task");
      expect(result[0]).toHaveProperty("Priority");
      expect(result[0]).not.toHaveProperty("Task ▼");
      
      // Sort icons should be stripped from cell values
      expect(result[0]["Task"]).toBe("Review");
      expect(result[0]["Priority"]).toBe("High");
    });

    it("normalizes whitespace in headers and cells", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "  Task  \n\n  Name  ", hasButton: false },
        ],
        rows: [
          [{ text: "  Review   Application  ", hasLink: false }],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result[0]).toHaveProperty("Task Name"); // Multi-space collapsed
      expect(result[0]["Task Name"]).toBe("Review Application");
    });

    it("provides column_N fallback for empty headers", async () => {
      // CRITICAL REGRESSION TEST: empty headers must get fallback keys
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: false },
          { text: "   ", hasButton: false }, // Empty after trim
          { text: "", hasButton: true }, // Empty button
        ],
        rows: [
          [
            { text: "Review", hasLink: false },
            { text: "Value1", hasLink: false },
            { text: "Value2", hasLink: false },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result[0]).toEqual({
        Task: "Review",
        column_2: "Value1", // Fallback key for empty header
        column_3: "Value2",
      });
    });

    it("filters hidden rows (display:none, not just aria-hidden)", async () => {
      // CRITICAL REGRESSION TEST: must filter CSS-hidden rows, not just aria-hidden
      const mockLocator = createWorkAllocationLocatorWithHiddenRows({
        headers: [{ text: "Task", hasButton: false }],
        rows: [
          { cells: [{ text: "Visible Task", hasLink: false }], hidden: false },
          { cells: [{ text: "Hidden Task", hasLink: false }], hidden: true, hiddenType: "display" },
          { cells: [{ text: "Another Visible", hasLink: false }], hidden: false },
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toHaveLength(2);
      expect(result[0]["Task"]).toBe("Visible Task");
      expect(result[1]["Task"]).toBe("Another Visible");
      
      // Hidden row should not appear
      const hasHiddenTask = result.some(row => row["Task"] === "Hidden Task");
      expect(hasHiddenTask).toBe(false);
    });

    it("handles rows with selection checkboxes in cells", async () => {
      // CRITICAL: Checkbox columns should show checkbox symbol or empty text
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "", hasButton: false }, // Checkbox header
          { text: "Task", hasButton: true },
          { text: "Assignee", hasButton: false },
        ],
        rows: [
          [
            { text: "☐", hasLink: false, hasCheckbox: true },
            { text: "Review Application", hasLink: true },
            { text: "Alice", hasLink: false },
          ],
          [
            { text: "☑", hasLink: false, hasCheckbox: true },
            { text: "Submit Documents", hasLink: true },
            { text: "Bob", hasLink: false },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      // Checkbox column should be included with symbol
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("column_1"); // Empty header gets fallback
      expect(result[0]["Task"]).toBe("Review Application");
      expect(result[1]["column_1"]).toBe("☑");
    });

    it("aligns selection columns without trimming data cells", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: false },
          { text: "Assignee", hasButton: false },
        ],
        rows: [
          [
            { text: "☐", hasLink: false },
            { text: "Review", hasLink: false },
            { text: "Alice", hasLink: false },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("pads work allocation rows when cells are missing", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: false },
          { text: "Assignee", hasButton: false },
          { text: "Due date", hasButton: false },
        ],
        rows: [
          [
            { text: "Review", hasLink: false },
            { text: "Alice", hasLink: false },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice", "Due date": "" },
      ]);
    });

    it("trims extra work allocation cells when a selection column is present", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: false },
          { text: "Assignee", hasButton: false },
        ],
        rows: [
          [
            { text: "☐", hasLink: false },
            { text: "Review", hasLink: false },
            { text: "Alice", hasLink: false },
            { text: "Extra", hasLink: false },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("filters rows when computed styles are unavailable", async () => {
      const headerRow = {
        querySelectorAll: () => [
          { innerText: "Task", textContent: "Task", colSpan: 1, rowSpan: 1 },
        ],
        hidden: false,
        hasAttribute: () => false,
        getClientRects: () => [{}],
        getAttribute: () => null,
        closest: () => null,
      };

      const dataRow = {
        querySelectorAll: () => [
          { innerText: "Review", textContent: "Review", colSpan: 1, rowSpan: 1, querySelector: () => null },
        ],
        hidden: false,
        hasAttribute: () => false,
        getClientRects: () => [{}],
        getAttribute: () => null,
        classList: { contains: () => false },
        querySelector: () => null,
        closest: () => null,
      };

      const thead = { querySelectorAll: () => [headerRow] };
      const tbody = { querySelectorAll: () => [dataRow] };
      const table = {
        querySelector: (sel: string) => (sel === "thead" ? thead : sel === "tbody" ? tbody : null),
        querySelectorAll: (sel: string) => (sel === "tr" ? [headerRow, dataRow] : []),
      };

      const mockLocator = {
        evaluate: vi.fn().mockImplementation((fn: (table: Element) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockReturnValue(null);

          try {
            return Promise.resolve(fn(table as unknown as Element));
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Locator;

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([]);
    });

    it("handles action buttons in data cells", async () => {
      // Action buttons in cells should extract button text
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: true },
          { text: "Actions", hasButton: false },
        ],
        rows: [
          [
            { text: "Review Application", hasLink: false },
            { text: "Assign", hasLink: false, hasButton: true },
          ],
          [
            { text: "Submit Documents", hasLink: false },
            { text: "Complete", hasLink: false, hasButton: true },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review Application", Actions: "Assign" },
        { Task: "Submit Documents", Actions: "Complete" },
      ]);
    });

    it("skips non-data rows with full-width colspans", async () => {
      const mockLocator = createWorkAllocationLocator({
        headers: [
          { text: "Task", hasButton: false },
          { text: "Assignee", hasButton: false },
        ],
        rows: [
          [
            { text: "Review", hasLink: false },
            { text: "Alice", hasLink: false },
          ],
          [
            { text: "Assign", hasLink: false, colSpan: 2 },
          ],
        ],
      });

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("skips action rows based on row class", async () => {
      const headerRow = {
        querySelectorAll: () => [
          { innerText: "Task", textContent: "Task", colSpan: 1, rowSpan: 1 },
          { innerText: "Assignee", textContent: "Assignee", colSpan: 1, rowSpan: 1 },
        ],
        hidden: false,
        hasAttribute: () => false,
        getClientRects: () => [{}],
        getAttribute: () => null,
        closest: (sel: string) => (sel === "thead" ? {} : null),
      };

      const dataRow = {
        querySelectorAll: () => [
          { innerText: "Review", textContent: "Review", colSpan: 1, rowSpan: 1, querySelector: () => null },
          { innerText: "Alice", textContent: "Alice", colSpan: 1, rowSpan: 1, querySelector: () => null },
        ],
        hidden: false,
        hasAttribute: () => false,
        getClientRects: () => [{}],
        getAttribute: () => null,
        classList: { contains: () => false },
        querySelector: () => null,
        closest: () => null,
      };

      const actionRow = {
        querySelectorAll: () => [
          { innerText: "Assign", textContent: "Assign", colSpan: 2, rowSpan: 1, querySelector: () => null },
        ],
        hidden: false,
        hasAttribute: () => false,
        getClientRects: () => [{}],
        getAttribute: () => null,
        classList: { contains: (name: string) => name === "actions-row" },
        querySelector: () => null,
        closest: () => null,
      };

      const thead = { querySelectorAll: () => [headerRow] };
      const tbody = { querySelectorAll: () => [dataRow, actionRow] };
      const table = {
        querySelector: (sel: string) => (sel === "thead" ? thead : sel === "tbody" ? tbody : null),
        querySelectorAll: (sel: string) => (sel === "tr" ? [headerRow, dataRow, actionRow] : []),
      };

      const mockLocator = {
        evaluate: vi.fn().mockImplementation((fn: (table: Element) => unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
            display: "block",
            visibility: "visible",
          });

          try {
            return Promise.resolve(fn(table as unknown as Element));
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).getComputedStyle;
          }
        }),
      } as unknown as Locator;

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([
        { Task: "Review", Assignee: "Alice" },
      ]);
    });

    it("returns an empty array when no headers can be derived", async () => {
      const emptyTable = {
        querySelector: (sel: string) => {
          if (sel === "thead") {
            return { querySelectorAll: () => [] };
          }
          if (sel === "tbody") {
            return { querySelectorAll: () => [] };
          }
          return null;
        },
        querySelectorAll: () => [],
      };

      const mockLocator = {
        evaluate: vi.fn().mockImplementation((fn: (table: Element) => unknown) => {
          return Promise.resolve(fn(emptyTable as unknown as Element));
        }),
      } as unknown as Locator;

      const result = await utils.parseWorkAllocationTable(mockLocator);

      expect(result).toEqual([]);
    });

    it("wraps Target closed errors with navigation guidance", async () => {
      const mockLocator = {
        evaluate: vi.fn().mockRejectedValue(new Error("Target closed")),
      } as unknown as Locator;

      await expect(
        utils.parseWorkAllocationTable(mockLocator)
      ).rejects.toThrow(/page may have crashed or navigated away/);
    });

    it("wraps non-navigation errors with a parse failure message", async () => {
      const mockLocator = {
        evaluate: vi.fn().mockRejectedValue(new Error("unexpected failure")),
      } as unknown as Locator;

      await expect(
        utils.parseWorkAllocationTable(mockLocator)
      ).rejects.toThrow("Failed to parse work allocation table: unexpected failure");
    });
  });

  describe("evaluateTable error handling", () => {
    it("wraps Target closed errors with context", async () => {
      const mockPage = {
        $$eval: vi.fn().mockRejectedValue(new Error("Target closed")),
      } as unknown as Page;

      await expect(
        utils.parseKeyValueTable("#table", mockPage)
      ).rejects.toThrow(/page may have crashed or navigated away/);
    });

    it("wraps Execution context errors with context", async () => {
      const mockPage = {
        $$eval: vi.fn().mockRejectedValue(new Error("Execution context was destroyed")),
      } as unknown as Page;

      await expect(
        utils.parseDataTable("#table", mockPage)
      ).rejects.toThrow(/page may have crashed or navigated away/);
    });

    it("requires page for string selectors", async () => {
      await expect(
        utils.parseKeyValueTable("#table")
      ).rejects.toThrow("Page instance required for string selectors");
    });
  });
});
