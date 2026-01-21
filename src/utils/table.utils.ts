import { Locator, Page } from "@playwright/test";

export class TableUtils {
  private static readonly SORT_ICON = "▼";
  private static readonly SCROLL_TIMEOUT_MS = 30_000;

  /**
   * Filter out hidden or invisible rows from DOM evaluation context
   * @param rows - Array of DOM Element rows to filter
   * @returns Array of visible rows only
   */
  private static filterVisibleRows(rows: Element[]): Element[] {
    return rows.filter((row) => {
      const el = row as HTMLElement;
      if (el.hidden || el.hasAttribute("hidden")) return false;
      const style = globalThis.getComputedStyle(el);
      if (!style || style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return el.getClientRects().length > 0;
    });
  }

  /**
   * Maps a given table as an object using table headers
   *
   * @param locator {@link Locator} - The table locator
   *
   */
  public async mapExuiTable(table: Locator): Promise<Record<string, string>[]> {
    return this.mapTable(table, (header) =>
      header.replace(`\t${TableUtils.SORT_ICON}`, "")
    );
  }

  /**
   * Maps a given table as an object using table headers
   *
   * @param locator {@link Locator} - The table locator
   *
   */
  public async mapCitizenTable(
    table: Locator
  ): Promise<Record<string, string>[]> {
    return this.mapTable(table);
  }

  /**
   * Parse CCD key-value table (2-column: label | value)
   * Used for case details tabs showing field labels and values
   *
   * **Features**:
   * - Filters out hidden/invisible rows automatically
   * - Removes Unicode sort icons (▼▲) from keys
   * - Joins multi-column values with spaces
   * - Throws if visible element has no extractable text
   *
   * @param selector - CSS selector string (requires `page`) or Playwright Locator
   * @param page - Page instance (required if selector is a string)
   * @returns Object with key-value pairs from the table
   * @throws {Error} If page not provided for string selector
   * @throws {Error} If visible element fails text extraction
   * @throws {Error} If page crashes or navigates during evaluation
   *
   * @example
   * ```ts
   * const details = await utils.parseKeyValueTable("#case-viewer", page);
   * expect(details["Applicant Name"]).toBe("John Doe");
   * ```
   */
  public async parseKeyValueTable(
    selector: string | Locator,
    page?: Page
  ): Promise<Record<string, string>> {
    if (typeof selector === "string" && !selector.trim()) {
      throw new Error("Selector cannot be empty");
    }

    return this.evaluateTable(selector, page, (rows: Element[]) => {
      const sortIconPattern = /[\u25B2\u25BC\u21E7\u21E9\u2BC5\u2BC6\u2191\u2193]/g;

      const extractText = (el: HTMLElement, required: boolean = false): string => {
        const text = (el.innerText || "").replaceAll(sortIconPattern, "").trim();
        if (required && !text && el.isConnected && el.offsetParent !== null) {
          throw new Error(
            `Failed to extract text from visible key cell: ${el.tagName}.${el.className}`
          );
        }
        return text;
      };

      const result: Record<string, string> = {};
      const visibleRows = TableUtils.filterVisibleRows(rows);

      for (const row of visibleRows) {
        const cells = Array.from(row.querySelectorAll("th, td"));
        if (cells.length < 2) continue;

        const firstCell = cells[0] as HTMLElement | undefined;
        if (!firstCell) continue;
        const key = extractText(firstCell, true); // Keys must have content
        if (!key) continue;

        // Value cells can be empty - join all, allow empty strings
        const values = cells.slice(1).map((cell) => extractText(cell as HTMLElement, false));
        result[key] = values.join(" ").replaceAll(/\s+/g, " ").trim();
      }
      return result;
    });
  }

  /**
   * Parse data table with headers (collections, documents, flags, etc.)
   * Returns array of row objects where keys are column headers
   *
   * **Features**:
   * - Auto-detects headers from <thead> or first row
   * - Filters hidden/invisible rows
   * - Removes sort icons from headers and cells
   * - Generates column_N fallback keys for missing headers
   *
   * @param selector - CSS selector string (requires `page`) or Playwright Locator
   * @param page - Page instance (required if selector is a string)
   * @returns Array of objects, one per visible data row
   * @throws {Error} If page not provided for string selector
   * @throws {Error} If page crashes or navigates during evaluation
   *
   * @example
   * ```ts
   * const documents = await utils.parseDataTable("#documents-table", page);
   * expect(documents[0]["Document Name"]).toBe("Application.pdf");
   * ```
   */
  public async parseDataTable(
    selector: string | Locator,
    page?: Page
  ): Promise<Array<Record<string, string>>> {
    if (typeof selector === "string" && !selector.trim()) {
      throw new Error("Selector cannot be empty");
    }

    return this.evaluateTable(selector, page, (rows: Element[]) => {
      const sortIconPattern = /[\u25B2\u25BC\u21E7\u21E9\u2BC5\u2BC6\u2191\u2193]/g;
      const cleanText = (text: string): string => {
        return text.replaceAll(sortIconPattern, "").trim().replaceAll(/\s+/g, " ");
      };

      const extractHeaders = (rowElements: Element[]): string[] => {
        if (!rowElements || rowElements.length === 0) return [];
        const firstRow = rowElements[0];
        if (!firstRow) return [];
        
        const table = firstRow.closest("table");
        const thead = table?.querySelector("thead");
        
        if (thead) {
          const headerCells = Array.from(thead.querySelectorAll("th, td"));
          return headerCells.map((cell) =>
            cleanText((cell as HTMLElement).innerText || "")
          );
        }
        
        const headerCells = Array.from(firstRow.querySelectorAll("th, td"));
        return headerCells.map((cell) =>
          cleanText((cell as HTMLElement).innerText || "")
        );
      };

      const isTheadRow = (row: Element): boolean => {
        return row.closest("thead") !== null;
      };

      if (!rows || rows.length === 0) return [];

      // Filter out thead rows first (critical fix for full table selectors)
      const nonTheadRows = Array.from(rows).filter(row => !isTheadRow(row));
      
      const headers = extractHeaders(rows);
      // If original rows had thead, all headers are already extracted; start at 0
      // If no thead, first non-thead row IS the header row, skip it (start at 1)
      const hasTheadElement = rows[0]?.closest("table")?.querySelector("thead") !== null;
      const startIndex = hasTheadElement ? 0 : 1;
      const dataRows = TableUtils.filterVisibleRows(nonTheadRows.slice(startIndex));
      const result: Array<Record<string, string>> = [];

      for (const row of dataRows) {
        const cells = Array.from(row.querySelectorAll("th, td"));
        if (cells.length === 0) continue;

        const rowData: Record<string, string> = {};
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i] as HTMLElement | undefined;
          if (!cell) continue;
          const header = headers[i];
          const key = header?.trim() || `column_${i + 1}`;
          rowData[key] = cleanText(cell.innerText || "");
        }
        result.push(rowData);
      }
      return result;
    });
  }

  /**
   * Parse work allocation table (with sortable headers)
   * Handles buttons in headers and links in cells
   *
   * **Features**:
   * - Extracts header text from buttons within <th> elements
   * - Extracts cell text from links within <td> elements
   * - Skips rows with aria-hidden="true"
   * - Optimized with parallel Promise.all() for performance
   *
   * @param tableLocator - Playwright Locator for the table element
   * @returns Array of row objects with header-value pairs
   * @throws {Error} If locator is null or undefined
   * @throws {Error} If table structure is invalid
   * @throws {Error} If page crashes or navigates during evaluation
   *
   * @example
   * ```ts
   * const tasks = await utils.parseWorkAllocationTable(page.locator(".work-table"));
   * expect(tasks[0]["Task"]).toBe("Review application");
   * ```
   */
  public async parseWorkAllocationTable(
    tableLocator: Locator
  ): Promise<Array<Record<string, string>>> {
    if (!tableLocator) {
      throw new Error("tableLocator cannot be null or undefined");
    }

    try {
      // Extract headers from <th> elements (buttons or text content)
      const headers = await tableLocator.locator("thead th").evaluateAll((thElements) => {
        const sortIconPattern = /[\u25B2\u25BC\u21E7\u21E9\u2BC5\u2BC6\u2191\u2193]/g;
        const cleanText = (text: string): string => {
          return text.replaceAll(sortIconPattern, "").trim().replaceAll(/\s+/g, " ");
        };

        return thElements.map((th, index) => {
          const button = th.querySelector("button");
          const text = button ? button.textContent : th.textContent;
          const cleaned = cleanText(text || "");
          return cleaned || `column_${index + 1}`; // Fallback for empty headers
        });
      });

      if (headers.length === 0) {
        return [];
      }

      // Extract all rows data in one evaluation to avoid race conditions
      const rowsData = await tableLocator.locator("tbody tr").evaluateAll((rowElements, headerNames) => {
        const sortIconPattern = /[\u25B2\u25BC\u21E7\u21E9\u2BC5\u2BC6\u2191\u2193]/g;
        const cleanText = (text: string): string => {
          return text.replaceAll(sortIconPattern, "").trim().replaceAll(/\s+/g, " ");
        };

        // Filter hidden rows (not just aria-hidden)
        const visibleRows = rowElements.filter((row) => {
          const el = row as HTMLElement;
          // Check aria-hidden
          if (el.getAttribute("aria-hidden") === "true") return false;
          // Check CSS visibility
          if (el.hidden || el.hasAttribute("hidden")) return false;
          const style = globalThis.getComputedStyle(el);
          if (!style || style.display === "none" || style.visibility === "hidden") {
            return false;
          }
          return el.getClientRects().length > 0;
        });

        const result: Array<Record<string, string>> = [];

        for (const row of visibleRows) {
          const cells = Array.from(row.querySelectorAll("td"));
          const rowData: Record<string, string> = {};

          for (let j = 0; j < headerNames.length; j++) {
            const header = headerNames[j];
            if (!header) continue;

            const cell = cells[j];
            if (!cell) {
              rowData[header] = ""; // Empty cell
              continue;
            }

            const link = cell.querySelector("a");
            const text = link ? link.textContent : cell.textContent;
            rowData[header] = cleanText(text || "");
          }

          result.push(rowData);
        }

        return result;
      }, headers);

      return rowsData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes("Target closed") || errorMsg.includes("Execution context")) {
        throw new Error(
          `Work allocation table evaluation failed - page may have crashed or navigated away. Error: ${errorMsg}`
        );
      }
      throw new Error(`Failed to parse work allocation table: ${errorMsg}`);
    }
  }

  /**
   * Map table data to array of row objects using headers
   * Handles cell alignment and selection cells
   * @param table - Playwright Locator for the table element
   * @param headerTransform - Optional function to transform header text
   * @returns Array of row objects with header-value pairs
   * @private
   */
  private async mapTable(
    table: Locator,
    headerTransform?: (h: string) => string
  ): Promise<Record<string, string>[]> {
    await table.scrollIntoViewIfNeeded({ timeout: TableUtils.SCROLL_TIMEOUT_MS });

    const headers = (await table.locator('thead tr th').allInnerTexts())
      .map(h => (headerTransform ? headerTransform(h) : h).trim());

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    const out: Record<string, string>[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator('th, td');
      const cellTexts = (await cells.allInnerTexts()).map((text) => text.trim());
      const alignedCells = this.alignCells(cellTexts, headers.length);

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length && j < alignedCells.length; j++) {
        const header = headers[j];
        if (!header) continue;
        rowData[header] = alignedCells[j] ?? "";
      }
      out.push(rowData);
    }
    return out;
  }

  /**
   * Align cell data with header count by trimming selection cells if needed
   * @param cells - Array of cell text values
   * @param headerCount - Expected number of headers
   * @returns Aligned array of cell values matching header count
   * @private
   */
  private alignCells(cells: string[], headerCount: number): string[] {
    if (cells.length === headerCount) {
      return cells;
    }

    const firstCell = cells.at(0);
    const selectionTrimmed =
      cells.length > headerCount && firstCell !== undefined && TableUtils.looksLikeSelectionCell(firstCell)
        ? cells.slice(1)
        : cells;

    if (selectionTrimmed.length > headerCount) {
      return selectionTrimmed.slice(0, headerCount);
    }
    return selectionTrimmed;
  }

  /**
   * Check if cell text represents a checkbox/selection cell
   * @param text - Cell text content to check
   * @returns True if text is empty or contains checkbox symbols (☐ ☑)
   * @private
   */
  private static looksLikeSelectionCell(text: string): boolean {
    const trimmed = text.trim();
    return trimmed === "" || trimmed === "☐" || trimmed === "☑";
  }

  /**
   * Execute table row evaluation function in browser context with error handling
   * Provides consistent error messages for page crashes and navigation issues
   * @param selector - CSS selector string or Playwright Locator
   * @param page - Page instance (required if selector is string)
   * @param fn - Evaluation function to run on table rows in browser context
   * @returns Result of evaluation function
   * @throws {Error} If page not provided for string selector
   * @throws {Error} If page crashes or navigates during evaluation
   * @private
   */
  private async evaluateTable<T>(
    selector: string | Locator,
    page: Page | undefined,
    fn: (rows: Element[]) => T
  ): Promise<T> {
    try {
      if (typeof selector !== "string") {
        return await selector.locator("tr").evaluateAll(fn);
      }
      if (!page) {
        throw new Error("Page instance required for string selectors");
      }
      return await page.$$eval(`${selector} tr`, fn);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const context = typeof selector === "string" ? selector : "Locator";
      
      if (errorMsg.includes("Target closed") || errorMsg.includes("Execution context")) {
        throw new Error(
          `Table evaluation failed - page may have crashed or navigated away. Selector: ${context}, Error: ${errorMsg}`
        );
      }
      throw new Error(`Failed to evaluate table (${context}): ${errorMsg}`);
    }
  }
}
