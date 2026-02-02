import { vi } from "vitest";
import type { Locator, Page } from "@playwright/test";

/**
 * Test helper: Create mock Page for parseKeyValueTable tests
 * Simulates 2-column key-value table rows
 */
export function createMockPage(
  rows: string[][],
  options?: { ariaHiddenRows?: number[] }
): Page {
  return {
    $$eval: vi.fn().mockImplementation((selector: string, fn: (rows: Element[]) => unknown) => {
      // Mock globalThis in the evaluation context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        const tableElement = {};
        // Simulate actual DOM elements
        const mockRows = rows.map((cells, rowIndex) => {
          const isAriaHidden = options?.ariaHiddenRows?.includes(rowIndex) ?? false;
          const mockCells = cells.map((text) => ({
            innerText: text,
            textContent: text,
            isConnected: true,
            offsetParent: {},
          }));
          
          return {
            querySelectorAll: () => mockCells,
            hidden: false,
            hasAttribute: () => false,
            getAttribute: (attr: string) => (
              attr === "aria-hidden" && isAriaHidden ? "true" : null
            ),
            isConnected: true,
            offsetParent: {},
            getClientRects: () => [{}],
            closest: (sel: string) => (sel === "table" ? tableElement : null),
          };
        });
        
        return fn(mockRows as unknown as Element[]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Page;
}

/**
 * Test helper: Create mock Locator for parseKeyValueTable tests
 * Simulates Locator-based table access
 */
export function createMockLocator(
  rows: string[][],
  options?: { ariaHiddenRows?: number[] }
): Locator {
  return {
    locator: vi.fn().mockReturnValue({
      evaluateAll: vi.fn().mockImplementation((fn: (rows: Element[]) => unknown) => {
        // Mock globalThis in the evaluation context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
          display: "block",
          visibility: "visible",
        });

        try {
          const tableElement = {};
          const mockRows = rows.map((cells, rowIndex) => {
            const isAriaHidden = options?.ariaHiddenRows?.includes(rowIndex) ?? false;
            const mockCells = cells.map((text) => ({
              innerText: text,
              textContent: text,
              isConnected: true,
              offsetParent: {},
            }));
            
            return {
              querySelectorAll: () => mockCells,
              hidden: false,
              hasAttribute: () => false,
              getAttribute: (attr: string) => (
                attr === "aria-hidden" && isAriaHidden ? "true" : null
              ),
              isConnected: true,
              offsetParent: {},
              getClientRects: () => [{}],
              closest: (sel: string) => (sel === "table" ? tableElement : null),
            };
          });
          
          return fn(mockRows as unknown as Element[]);
        } finally {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (globalThis as any).getComputedStyle;
        }
      }),
    }),
  } as unknown as Locator;
}

/**
 * Test helper: Create mock Page for parseDataTable tests
 * Supports thead and tbody row structures
 */
export function createMockDataTable(config: {
  hasThead: boolean;
  headers: string[];
  rows: string[][];
  headerRowUsesTh?: boolean;
  ariaHiddenRows?: number[];
}): Page {
  return {
    $$eval: vi.fn().mockImplementation((selector: string, fn: (rows: Element[]) => unknown) => {
      // Mock globalThis in the evaluation context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        const headerCells = config.headers.map((text) => ({
          innerText: text,
          textContent: text,
          colSpan: 1,
          rowSpan: 1,
        }));

        const headerRowUsesTh = config.headerRowUsesTh ?? true;
        const theadRow = {
          querySelectorAll: (sel: string) => {
            if (sel === "th, td") {
              return headerCells;
            }
            if (sel === "th") {
              return headerRowUsesTh ? headerCells : [];
            }
            return [];
          },
        };

        const thead = {
          querySelectorAll: (sel: string) => {
            if (sel === "tr") {
              return [theadRow];
            }
            return [];
          },
        };

        const tableElement = config.hasThead ? {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return thead;
            }
            return null;
          },
        } : {
          querySelector: () => null,
        };

        const headerRow = {
          closest: (sel: string) => {
            if (sel === "table") return tableElement;
            if (sel === "thead") return null; // Header row is NOT in thead (it's a regular tbody row)
            return null;
          },
          querySelectorAll: (sel: string) => {
            if (sel === "th, td") {
              return headerCells;
            }
            if (sel === "th") {
              return headerRowUsesTh ? headerCells : [];
            }
            return [];
          },
          hidden: false,
          hasAttribute: () => false,
          getAttribute: () => null,
          getClientRects: () => [{}],
        };

        const dataRows = config.rows.map((cells, rowIndex) => {
          const isAriaHidden = config.ariaHiddenRows?.includes(rowIndex) ?? false;
          return {
            querySelectorAll: (sel: string) => {
              if (sel === "th, td") {
                return cells.map((text) => ({ innerText: text, textContent: text }));
              }
              if (sel === "th") {
                return [];
              }
              return [];
            },
            hidden: false,
            hasAttribute: () => false,
            getAttribute: (attr: string) => (
              attr === "aria-hidden" && isAriaHidden ? "true" : null
            ),
            getClientRects: () => [{}],
            closest: (sel: string) => {
              if (sel === "table") return tableElement;
              if (sel === "thead") return null; // Data rows are NOT in thead (they're tbody rows)
              return null;
            },
          };
        });

        // When thead exists, only pass data rows (headers are in thead)
        // When no thead, pass header row + data rows (first row becomes headers)
        const allRows = config.hasThead 
          ? dataRows
          : [headerRow, ...dataRows];

        return fn(allRows as unknown as Element[]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Page;
}

/**
 * Test helper: Create mock Page for parseDataTable tests with complex header rows
 * Supports multiple header rows with colSpan/rowSpan for header merging tests
 */
export function createMockDataTableWithHeaderRows(config: {
  headerRows: Array<Array<{ text: string; colSpan?: number; rowSpan?: number }>>;
  rows: string[][];
}): Page {
  return {
    $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        const theadRows: Array<{
          querySelectorAll: (sel: string) => Array<{
            innerText: string;
            textContent: string;
            colSpan: number;
            rowSpan: number;
          }>;
          hidden: boolean;
          hasAttribute: () => boolean;
          getClientRects: () => Array<unknown>;
          closest: (sel: string) => unknown;
        }> = [];

        const thead = {
          querySelectorAll: (sel: string) => {
            if (sel === "tr") {
              return theadRows;
            }
            return [];
          },
        };

        const table = {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return thead;
            }
            return null;
          },
        };

        for (const row of config.headerRows) {
          theadRows.push({
            querySelectorAll: (sel: string) => {
              if (sel === "th, td") {
                return row.map((cell) => ({
                  innerText: cell.text,
                  textContent: cell.text,
                  colSpan: cell.colSpan ?? 1,
                  rowSpan: cell.rowSpan ?? 1,
                }));
              }
              return [];
            },
            hidden: false,
            hasAttribute: () => false,
            getClientRects: () => [{}],
            closest: (sel: string) => {
              if (sel === "table") return table;
              if (sel === "thead") return thead;
              return null;
            },
          });
        }

        const dataRows = config.rows.map((cells) => ({
          querySelectorAll: () => cells.map((text) => ({
            innerText: text,
            textContent: text,
            colSpan: 1,
            rowSpan: 1,
          })),
          hidden: false,
          hasAttribute: () => false,
          getClientRects: () => [{}],
          closest: (sel: string) => {
            if (sel === "table") return table;
            if (sel === "thead") return null;
            return null;
          },
        }));

        return fn(dataRows as unknown as Element[]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Page;
}

/**
 * Test helper: Create mock Locator for parseWorkAllocationTable tests
 * Handles buttons in headers and links in cells
 */
export function createWorkAllocationLocator(config: {
  headers: Array<{ text: string; hasButton: boolean }>;
  rows: Array<Array<{
    text: string;
    hasLink: boolean;
    ariaHidden?: boolean;
    hasCheckbox?: boolean;
    hasButton?: boolean;
    colSpan?: number;
    rowSpan?: number;
  }>>;
  hasThead?: boolean;
  headerRowUsesTh?: boolean;
}): Locator {
  const hasThead = config.hasThead ?? true;
  const headerRowUsesTh = config.headerRowUsesTh ?? true;

  const createCell = (cell: {
    text: string;
    hasLink?: boolean;
    hasCheckbox?: boolean;
    hasButton?: boolean;
    colSpan?: number;
    rowSpan?: number;
  }) => {
    const link = cell.hasLink
      ? { innerText: cell.text, textContent: cell.text }
      : null;
    const checkbox = cell.hasCheckbox ? { type: "checkbox", checked: false } : null;
    const button = cell.hasButton
      ? { innerText: cell.text, textContent: cell.text }
      : null;

    return {
      innerText: cell.text,
      textContent: cell.text,
      colSpan: cell.colSpan ?? 1,
      rowSpan: cell.rowSpan ?? 1,
      querySelector: (sel: string) => {
        if (sel === "a") return link;
        if (sel === "input[type='checkbox']") return checkbox;
        if (sel === "button") return button;
        return null;
      },
    };
  };

  let thead: { querySelectorAll: (sel: string) => unknown[] } | null = null;

  const headerRow = {
    querySelectorAll: (sel: string) => {
      if (sel === "th, td") {
        return config.headers.map((header) =>
          createCell({ text: header.text, hasButton: header.hasButton })
        );
      }
      if (sel === "th") {
        return headerRowUsesTh
          ? config.headers.map((header) =>
              createCell({ text: header.text, hasButton: header.hasButton })
            )
          : [];
      }
      return [];
    },
    hidden: false,
    hasAttribute: () => false,
    getClientRects: () => [{}],
    getAttribute: () => null,
    closest: (sel: string) => {
      if (sel === "table") return table;
      if (sel === "thead") return thead;
      return null;
    },
  };

  const dataRows = config.rows.map((cells) => {
    const isHidden = cells.some(c => c.ariaHidden);
    return {
      querySelectorAll: (sel: string) => {
        if (sel === "th, td") {
          return cells.map((cell) => createCell(cell));
        }
        if (sel === "th") {
          return [];
        }
        return [];
      },
      hidden: false,
      hasAttribute: () => false,
      getClientRects: () => [{}],
      getAttribute: (attr: string) => (attr === "aria-hidden" && isHidden) ? "true" : null,
      closest: (sel: string) => {
        if (sel === "table") return table;
        if (sel === "thead") return null;
        return null;
      },
    };
  });

  const bodyRows = hasThead ? dataRows : [headerRow, ...dataRows];

  thead = hasThead
    ? { querySelectorAll: (sel: string) => (sel.includes("tr") ? [headerRow] : []) }
    : null;

  const tbody = {
    querySelectorAll: (sel: string) => (sel.includes("tr") ? bodyRows : []),
  };

  const table: { querySelector: (sel: string) => unknown; querySelectorAll: (sel: string) => unknown[] } = {
    querySelector: (sel: string) => {
      if (sel === "thead") return thead;
      if (sel === "tbody") return tbody;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes("tr")) {
        return hasThead ? [headerRow, ...bodyRows] : bodyRows;
      }
      return [];
    },
  };

  return {
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
}

/**
 * Test helper: Create mock Page with actual thead rows included
 * For regression testing thead row filtering
 */
export function createMockDataTableWithActualTheadRows(config: {
  theadRows: string[][];
  tbodyRows: string[][];
}): Page {
  return {
    $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        const theadRows: Array<{
          querySelectorAll: (sel: string) => Array<{
            innerText: string;
            textContent: string;
            colSpan: number;
            rowSpan: number;
          }>;
          hidden: boolean;
          hasAttribute: () => boolean;
          getClientRects: () => Array<unknown>;
          closest: (sel: string) => unknown;
        }> = [];

        const thead = {
          querySelectorAll: (sel: string) => {
            if (sel === "tr") {
              return theadRows;
            }
            return [];
          },
        };

        const table = {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return thead;
            }
            return null;
          },
        };

        for (const cells of config.theadRows) {
          theadRows.push({
            querySelectorAll: (sel: string) => {
              if (sel === "th, td") {
                return cells.map((text) => ({
                  innerText: text,
                  textContent: text,
                  colSpan: 1,
                  rowSpan: 1,
                }));
              }
              return [];
            },
            hidden: false,
            hasAttribute: () => false,
            getClientRects: () => [{}],
            closest: (sel: string) => {
              if (sel === "table") return table;
              if (sel === "thead") return thead;
              return null;
            },
          });
        }

        // Create tbody rows (these should be returned as data)
        const tbodyRows = config.tbodyRows.map((cells) => ({
          querySelectorAll: () => cells.map((text) => ({
            innerText: text,
            textContent: text,
            colSpan: 1,
            rowSpan: 1,
          })),
          hidden: false,
          hasAttribute: () => false,
          getClientRects: () => [{}],
          closest: (sel: string) => {
            if (sel === "table") return table;
            if (sel === "thead") return null; // This row is NOT in thead
            return null;
          },
        }));

        // Simulate real-world: $$eval('#table tr') returns BOTH thead and tbody rows
        const allRows = [...theadRows, ...tbodyRows];

        return fn(allRows as unknown as Element[]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Page;
}

/**
 * Test helper: Create mock Locator with hidden rows (CSS display/visibility)
 * For regression testing CSS-based row hiding
 */
export function createWorkAllocationLocatorWithHiddenRows(config: {
  headers: Array<{ text: string; hasButton: boolean }>;
  rows: Array<{
    cells: Array<{ text: string; hasLink: boolean; hasCheckbox?: boolean; hasButton?: boolean }>;
    hidden: boolean;
    hiddenType?: "aria" | "display" | "visibility";
  }>;
}): Locator {
  const createCell = (cell: {
    text: string;
    hasLink: boolean;
    hasCheckbox?: boolean;
    hasButton?: boolean;
  }) => {
    const link = cell.hasLink ? { innerText: cell.text, textContent: cell.text } : null;
    const checkbox = cell.hasCheckbox ? { type: "checkbox", checked: false } : null;
    const button = cell.hasButton ? { innerText: cell.text, textContent: cell.text } : null;

    return {
      innerText: cell.text,
      textContent: cell.text,
      colSpan: 1,
      rowSpan: 1,
      querySelector: (sel: string) => {
        if (sel === "a") return link;
        if (sel === "input[type='checkbox']") return checkbox;
        if (sel === "button") return button;
        return null;
      },
    };
  };

  let thead: { querySelectorAll: (sel: string) => unknown[] } | null = null;
  const headerRow = {
    querySelectorAll: (sel: string) => {
      if (sel === "th, td") {
        return config.headers.map((header) =>
          createCell({ text: header.text, hasLink: false, hasButton: header.hasButton })
        );
      }
      if (sel === "th") {
        return config.headers.map((header) =>
          createCell({ text: header.text, hasLink: false, hasButton: header.hasButton })
        );
      }
      return [];
    },
    hidden: false,
    hasAttribute: () => false,
    getClientRects: () => [{}],
    getAttribute: () => null,
    closest: (sel: string) => {
      if (sel === "table") return table;
      if (sel === "thead") return thead;
      return null;
    },
  };

  thead = {
    querySelectorAll: (sel: string) => (sel.includes("tr") ? [headerRow] : []),
  };

  const bodyRows = config.rows.map((rowConfig) => ({
    querySelectorAll: (sel: string) => {
      if (sel === "th, td") {
        return rowConfig.cells.map((cell) => createCell(cell));
      }
      return [];
    },
    hidden: rowConfig.hidden && rowConfig.hiddenType === "display",
    hasAttribute: (attr: string) => {
      if (attr === "hidden") return rowConfig.hidden && rowConfig.hiddenType === "display";
      return false;
    },
    getClientRects: () => (rowConfig.hidden ? [] : [{}]),
    getAttribute: (attr: string) => {
      if (attr === "aria-hidden" && rowConfig.hidden && rowConfig.hiddenType === "aria") {
        return "true";
      }
      return null;
    },
    hiddenType: rowConfig.hiddenType,
    closest: (sel: string) => {
      if (sel === "table") return table;
      if (sel === "thead") return null;
      return null;
    },
  }));

  const tbody = {
    querySelectorAll: (sel: string) => (sel.includes("tr") ? bodyRows : []),
  };

  const table: { querySelector: (sel: string) => unknown; querySelectorAll: (sel: string) => unknown[] } = {
    querySelector: (sel: string) => {
      if (sel === "thead") return thead;
      if (sel === "tbody") return tbody;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes("tr")) {
        return [headerRow, ...bodyRows];
      }
      return [];
    },
  };

  return {
    evaluate: vi.fn().mockImplementation((fn: (table: Element) => unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockImplementation((el: { hiddenType?: string }) => {
        if (el.hiddenType === "display") {
          return { display: "none", visibility: "visible" };
        }
        if (el.hiddenType === "visibility") {
          return { display: "block", visibility: "hidden" };
        }
        return { display: "block", visibility: "visible" };
      });

      try {
        return Promise.resolve(fn(table as unknown as Element));
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Locator;
}

/**
 * Test helper: Create mock Page with checkbox columns for parseDataTable tests
 * Simulates tables with selection checkboxes in data cells
 */
export function createMockDataTableWithCheckboxes(config: {
  hasThead: boolean;
  headers: string[];
  rows: Array<{ cells: string[]; hasCheckbox: boolean }>;
}): Page {
  return {
    $$eval: vi.fn().mockImplementation((_selector: string, fn: (rows: Element[]) => unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        const headerCells = config.headers.map((text) => ({
          innerText: text,
          textContent: text,
          colSpan: 1,
          rowSpan: 1,
        }));

        const theadRow = {
          querySelectorAll: (sel: string) => {
            if (sel === "th, td") {
              return headerCells;
            }
            if (sel === "th") {
              return headerCells;
            }
            return [];
          },
        };

        const thead = {
          querySelectorAll: (sel: string) => {
            if (sel === "tr") {
              return [theadRow];
            }
            return [];
          },
        };

        const tableElement = config.hasThead ? {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return thead;
            }
            return null;
          },
        } : {
          querySelector: () => null,
        };

        const dataRows = config.rows.map((rowConfig) => {
          const cells = rowConfig.cells.map((text) => ({
            innerText: text,
            textContent: text,
            colSpan: 1,
            rowSpan: 1,
            querySelector: (sel: string) => {
              // First cell might have checkbox
              if (sel === "input[type='checkbox']" && rowConfig.hasCheckbox) {
                return { type: "checkbox", checked: false };
              }
              return null;
            },
          }));

          return {
            querySelectorAll: (sel: string) => {
              if (sel === "th, td") {
                return cells;
              }
              if (sel === "th") {
                return [];
              }
              return [];
            },
            hidden: false,
            hasAttribute: () => false,
            getClientRects: () => [{}],
            closest: (sel: string) => {
              if (sel === "table") return tableElement;
              if (sel === "thead") return null;
              return null;
            },
          };
        });

        return fn(dataRows as unknown as Element[]);
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).getComputedStyle;
      }
    }),
  } as unknown as Page;
}
