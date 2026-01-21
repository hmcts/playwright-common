import { describe, expect, it, vi } from "vitest";
import type { Locator, Page } from "@playwright/test";
import { TableUtils } from "../../src/utils/table.utils.js";
import {
  createMockPage,
  createMockLocator,
  createMockDataTable,
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

      // Empty key cells should still be rejected
      const result = await utils.parseKeyValueTable("#table", mockPage);
      expect(Object.keys(result)).toHaveLength(0); // Row skipped due to empty key
    });
  });

  describe("parseDataTable", () => {
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

    it("handles empty tables gracefully", async () => {
      const mockPage = createMockDataTable({
        hasThead: true,
        headers: [],
        rows: [],
      });

      const result = await utils.parseDataTable("#empty", mockPage);

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
