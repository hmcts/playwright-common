import { Locator, Page } from "@playwright/test";
import {
  cleanTableText,
  looksLikeSelectionCellText,
  parseDataSnapshot,
  parseKeyValueSnapshot,
  parseWorkAllocationSnapshot,
  type TableSnapshot,
} from "./table.utils.helpers.js";

export class TableUtils {
  private static readonly SCROLL_TIMEOUT_MS = 30_000;

  private static cleanHeaderText(text: string): string {
    return cleanTableText(text);
  }

  /**
   * Maps a given table as an object using table headers
   *
   * @param locator {@link Locator} - The table locator
   *
   */
  public async mapExuiTable(table: Locator): Promise<Record<string, string>[]> {
    return this.mapTable(table, TableUtils.cleanHeaderText);
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
    return this.mapTable(table, TableUtils.cleanHeaderText);
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

    const snapshot = await this.buildTableSnapshot(selector, page);
    return parseKeyValueSnapshot(snapshot);
  }

  /**
   * Parse data table with headers (collections, documents, flags, etc.)
   * Returns array of row objects where keys are column headers
   *
   * **Features**:
   * - Auto-detects headers from <thead> or first row with <th> cells
   * - Expands colspans/rowspans and merges multi-row headers
   * - Filters hidden/invisible rows
   * - Removes sort icons from headers and cells
   * - Generates column_N fallback keys for missing headers
   * - Preserves headerless tables by using column_N keys for all rows
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

    const snapshot = await this.buildTableSnapshot(selector, page);
    return parseDataSnapshot(snapshot);
  }

  /**
   * Parse work allocation table (with sortable headers)
   * Handles buttons in headers and links in cells
   *
   * **Features**:
   * - Supports <thead> headers or falls back to the first body row with <th> cells
   * - Extracts cell text from links/buttons within <td> or <th> cells
   * - Handles colspans/rowspans in header rows
   * - Skips rows hidden by aria or CSS visibility
   * - Preserves headerless tables by using column_N keys for all rows
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
      const snapshot = await this.buildWorkAllocationSnapshot(tableLocator);
      return parseWorkAllocationSnapshot(snapshot);
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

    const headers = (
      await table.locator("thead tr th, thead tr td").allInnerTexts()
    ).map((header) => {
      const normalized = headerTransform ? headerTransform(header) : header;
      return normalized.trim();
    });

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    const out: Record<string, string>[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible())) continue;
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
      cells.length > headerCount &&
      firstCell !== undefined &&
      TableUtils.looksLikeSelectionCell(firstCell)
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
    return looksLikeSelectionCellText(text);
  }

  private async buildTableSnapshot(
    selector: string | Locator,
    page: Page | undefined
  ): Promise<TableSnapshot> {
    return this.evaluateTable(selector, page, (rows: Element[]) => {
      const table = rows[0]?.closest?.("table") ?? null;
      const thead =
        table && typeof table.querySelector === "function"
          ? table.querySelector("thead")
          : null;
      const hasThead = thead !== null && thead !== undefined;
      const theadRows: Element[] =
        thead && typeof thead.querySelectorAll === "function"
          ? Array.from(thead.querySelectorAll("tr"))
          : [];
      const theadRowSet = new Set(theadRows);
      const rowSet = new Set<Element>();
      const combinedRows: Element[] = [];

      const addRow = (row: Element) => {
        if (!rowSet.has(row)) {
          rowSet.add(row);
          combinedRows.push(row);
        }
      };

      theadRows.forEach(addRow);
      rows.forEach(addRow);

      const scopedRows = table
        ? combinedRows.filter((row) => {
            if (typeof row.closest === "function") {
              return row.closest("table") === table;
            }
            return theadRowSet.has(row);
          })
        : combinedRows;

      const rowSnapshots = scopedRows.map((row) => {
        const rowElement = row as HTMLElement;
        const headerCellCount = rowElement.querySelectorAll("th").length;
        const isHeaderRow = headerCellCount > 0;
        const cellElements = Array.from(rowElement.querySelectorAll("th, td"));

        const cells = cellElements.map((cell) => {
          const cellElement = cell as HTMLElement;
          const link =
            typeof cellElement.querySelector === "function"
              ? cellElement.querySelector("a")
              : null;
          const button =
            typeof cellElement.querySelector === "function"
              ? cellElement.querySelector("button")
              : null;
          const rawText = cellElement.innerText || cellElement.textContent || "";
          const linkText =
            link
              ? (link as HTMLElement).innerText || (link as HTMLElement).textContent || ""
              : undefined;
          const buttonText =
            button
              ? (button as HTMLElement).innerText || (button as HTMLElement).textContent || ""
              : undefined;
          const colSpan = Math.max(
            (cell as HTMLTableCellElement).colSpan || 1,
            1
          );
          const rowSpan = Math.max(
            (cell as HTMLTableCellElement).rowSpan || 1,
            1
          );

          const snapshot = {
            rawText,
            colSpan,
            rowSpan,
            isHeader: isHeaderRow,
          } as {
            rawText: string;
            colSpan: number;
            rowSpan: number;
            isHeader: boolean;
            linkText?: string;
            buttonText?: string;
          };
          if (linkText !== undefined) {
            snapshot.linkText = linkText;
          }
          if (buttonText !== undefined) {
            snapshot.buttonText = buttonText;
          }
          return snapshot;
        });

        const style =
          typeof globalThis.getComputedStyle === "function"
            ? globalThis.getComputedStyle(rowElement)
            : null;
        const rects =
          typeof rowElement.getClientRects === "function"
            ? rowElement.getClientRects()
            : [];
        const isVisible =
          !!style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rects.length > 0;
        const isHiddenAttr =
          rowElement.hidden ||
          (typeof rowElement.hasAttribute === "function" &&
            rowElement.hasAttribute("hidden"));
        const isAriaHidden =
          typeof rowElement.getAttribute === "function" &&
          rowElement.getAttribute("aria-hidden") === "true";
        const isTheadRow =
          theadRowSet.has(row) || row.closest?.("thead") !== null;
        const className =
          typeof rowElement.className === "string"
            ? rowElement.className.trim()
            : "";
        const hasActionsRowClass =
          typeof rowElement.classList?.contains === "function"
            ? rowElement.classList.contains("actions-row")
            : className.split(/\s+/).includes("actions-row");
        const hasFooterRowClass =
          typeof rowElement.classList?.contains === "function"
            ? rowElement.classList.contains("footer-row")
            : className.split(/\s+/).includes("footer-row");
        const hasActionsCell =
          typeof rowElement.querySelector === "function"
            ? rowElement.querySelector("td.cell-actions") !== null
            : false;
        const hasFooterCell =
          typeof rowElement.querySelector === "function"
            ? rowElement.querySelector("td.cell-footer") !== null
            : false;
        const totalColSpan = cells.reduce(
          (sum, cell) => sum + cell.colSpan,
          0
        );

        const snapshot = {
          cells,
          isTheadRow,
          isAriaHidden,
          isHiddenAttr: Boolean(isHiddenAttr),
          isVisible,
          hasActionsCell,
          hasFooterCell,
          hasActionsRowClass,
          hasFooterRowClass,
          totalColSpan,
        } as {
          cells: typeof cells;
          isTheadRow: boolean;
          isAriaHidden: boolean;
          isHiddenAttr: boolean;
          isVisible: boolean;
          className?: string;
          hasActionsCell: boolean;
          hasFooterCell: boolean;
          hasActionsRowClass: boolean;
          hasFooterRowClass: boolean;
          totalColSpan: number;
        };
        if (className) {
          snapshot.className = className;
        }
        return snapshot;
      });

      return { rows: rowSnapshots, hasThead };
    });
  }

  private async buildWorkAllocationSnapshot(
    tableLocator: Locator
  ): Promise<TableSnapshot> {
    return tableLocator.evaluate((table) => {
      const selectDirectRows = (container: Element | null): Element[] => {
        if (!container) return [];
        return Array.from(container.querySelectorAll(":scope > tr"));
      };

      const selectTableRows = (tableElement: HTMLTableElement): Element[] => {
        return Array.from(
          tableElement.querySelectorAll(
            ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"
          )
        );
      };

      const tableElement = table as HTMLTableElement;
      const thead = tableElement.querySelector("thead");
      const tbody = tableElement.querySelector("tbody");
      const hasThead = thead !== null && thead !== undefined;
      const theadRows: Element[] = thead ? selectDirectRows(thead) : [];
      const theadRowSet = new Set(theadRows);
      let dataRows = tbody ? selectDirectRows(tbody) : selectTableRows(tableElement);

      if (theadRows.length > 0) {
        dataRows = dataRows.filter((row) => row.closest("thead") === null);
      }

      const rows = [...theadRows, ...dataRows];
      const rowSnapshots = rows.map((row) => {
        const rowElement = row as HTMLElement;
        const headerCellCount = rowElement.querySelectorAll("th").length;
        const isHeaderRow = headerCellCount > 0;
        const cellElements = Array.from(rowElement.querySelectorAll("th, td"));

        const cells = cellElements.map((cell) => {
          const cellElement = cell as HTMLElement;
          const link =
            typeof cellElement.querySelector === "function"
              ? cellElement.querySelector("a")
              : null;
          const button =
            typeof cellElement.querySelector === "function"
              ? cellElement.querySelector("button")
              : null;
          const rawText = cellElement.innerText || cellElement.textContent || "";
          const linkText =
            link
              ? (link as HTMLElement).innerText || (link as HTMLElement).textContent || ""
              : undefined;
          const buttonText =
            button
              ? (button as HTMLElement).innerText || (button as HTMLElement).textContent || ""
              : undefined;
          const colSpan = Math.max(
            (cell as HTMLTableCellElement).colSpan || 1,
            1
          );
          const rowSpan = Math.max(
            (cell as HTMLTableCellElement).rowSpan || 1,
            1
          );

          const snapshot = {
            rawText,
            colSpan,
            rowSpan,
            isHeader: isHeaderRow,
          } as {
            rawText: string;
            colSpan: number;
            rowSpan: number;
            isHeader: boolean;
            linkText?: string;
            buttonText?: string;
          };
          if (linkText !== undefined) {
            snapshot.linkText = linkText;
          }
          if (buttonText !== undefined) {
            snapshot.buttonText = buttonText;
          }
          return snapshot;
        });

        const style =
          typeof globalThis.getComputedStyle === "function"
            ? globalThis.getComputedStyle(rowElement)
            : null;
        const rects =
          typeof rowElement.getClientRects === "function"
            ? rowElement.getClientRects()
            : [];
        const isVisible =
          !!style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rects.length > 0;
        const isHiddenAttr =
          rowElement.hidden ||
          (typeof rowElement.hasAttribute === "function" &&
            rowElement.hasAttribute("hidden"));
        const isAriaHidden =
          typeof rowElement.getAttribute === "function" &&
          rowElement.getAttribute("aria-hidden") === "true";
        const isTheadRow =
          theadRowSet.has(row) || row.closest?.("thead") !== null;
        const className =
          typeof rowElement.className === "string"
            ? rowElement.className.trim()
            : "";
        const hasActionsRowClass =
          typeof rowElement.classList?.contains === "function"
            ? rowElement.classList.contains("actions-row")
            : className.split(/\s+/).includes("actions-row");
        const hasFooterRowClass =
          typeof rowElement.classList?.contains === "function"
            ? rowElement.classList.contains("footer-row")
            : className.split(/\s+/).includes("footer-row");
        const hasActionsCell =
          typeof rowElement.querySelector === "function"
            ? rowElement.querySelector("td.cell-actions") !== null
            : false;
        const hasFooterCell =
          typeof rowElement.querySelector === "function"
            ? rowElement.querySelector("td.cell-footer") !== null
            : false;
        const totalColSpan = cells.reduce(
          (sum, cell) => sum + cell.colSpan,
          0
        );

        const snapshot = {
          cells,
          isTheadRow,
          isAriaHidden,
          isHiddenAttr: Boolean(isHiddenAttr),
          isVisible,
          hasActionsCell,
          hasFooterCell,
          hasActionsRowClass,
          hasFooterRowClass,
          totalColSpan,
        } as {
          cells: typeof cells;
          isTheadRow: boolean;
          isAriaHidden: boolean;
          isHiddenAttr: boolean;
          isVisible: boolean;
          className?: string;
          hasActionsCell: boolean;
          hasFooterCell: boolean;
          hasActionsRowClass: boolean;
          hasFooterRowClass: boolean;
          totalColSpan: number;
        };
        if (className) {
          snapshot.className = className;
        }
        return snapshot;
      });

      return { rows: rowSnapshots, hasThead };
    });
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
        const rowSelector = ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr";
        return await selector.locator(rowSelector).evaluateAll(fn);
      }
      if (!page) {
        throw new Error("Page instance required for string selectors");
      }
      const rowSelector =
        `${selector} > thead > tr, ${selector} > tbody > tr, ${selector} > tfoot > tr, ${selector} > tr`;
      return await page.$$eval(rowSelector, fn);
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
