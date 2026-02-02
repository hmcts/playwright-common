import { vi } from "vitest";
import type { Locator, Page } from "@playwright/test";

/**
 * Test helper: Create mock Page for parseKeyValueTable tests
 * Simulates 2-column key-value table rows
 */
export function createMockPage(rows: string[][]): Page {
  return {
    $$eval: vi.fn().mockImplementation((selector: string, fn: (rows: Element[]) => unknown) => {
      // Mock globalThis in the evaluation context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
        display: "block",
        visibility: "visible",
      });

      try {
        // Simulate actual DOM elements
        const mockRows = rows.map((cells) => {
          const mockCells = cells.map((text) => ({
            innerText: text,
            textContent: text,
          }));
          
          return {
            querySelectorAll: () => mockCells,
            hidden: false,
            hasAttribute: () => false,
            isConnected: true,
            offsetParent: {},
            getClientRects: () => [{}],
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
export function createMockLocator(rows: string[][]): Locator {
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
          const mockRows = rows.map((cells) => {
            const mockCells = cells.map((text) => ({
              innerText: text,
              textContent: text,
            }));
            
            return {
              querySelectorAll: () => mockCells,
              hidden: false,
              hasAttribute: () => false,
              isConnected: true,
              offsetParent: {},
              getClientRects: () => [{}],
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
        const tableElement = config.hasThead ? {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return {
                querySelectorAll: () =>
                  config.headers.map((h) => ({ innerText: h, textContent: h })),
              };
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
          querySelectorAll: () => config.headers.map((h) => ({ innerText: h, textContent: h })),
          hidden: false,
          hasAttribute: () => false,
          getClientRects: () => [{}],
        };

        const dataRows = config.rows.map((cells) => ({
          querySelectorAll: () => cells.map((text) => ({ innerText: text, textContent: text })),
          hidden: false,
          hasAttribute: () => false,
          getClientRects: () => [{}],
          closest: (sel: string) => {
            if (sel === "table") return tableElement;
            if (sel === "thead") return null; // Data rows are NOT in thead (they're tbody rows)
            return null;
          },
        }));

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
 * Test helper: Create mock Locator for parseWorkAllocationTable tests
 * Handles buttons in headers and links in cells
 */
export function createWorkAllocationLocator(config: {
  headers: Array<{ text: string; hasButton: boolean }>;
  rows: Array<Array<{ text: string; hasLink: boolean; ariaHidden?: boolean; hasCheckbox?: boolean; hasButton?: boolean }>>;
}): Locator {
  return {
    locator: vi.fn().mockImplementation((selector: string) => {
      if (selector === "thead th") {
        return {
          evaluateAll: vi.fn().mockImplementation((fn: (elements: Element[]) => unknown) => {
            const mockThElements = config.headers.map((h) => {
              const button = h.hasButton ? { textContent: h.text } : null;
              return {
                querySelector: () => button,
                textContent: h.text,
              };
            });
            return Promise.resolve(fn(mockThElements as unknown as Element[]));
          }),
        };
      }
      if (selector === "tbody tr") {
        return {
          evaluateAll: vi.fn().mockImplementation((fn: (elements: Element[], headers: string[]) => unknown, headers: string[]) => {
            // Mock globalThis.getComputedStyle for hidden row filtering
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
              display: "block",
              visibility: "visible",
            });

            try {
              const mockRowElements = config.rows.map((cells) => {
                const isHidden = cells.some(c => c.ariaHidden);
                const mockCells = cells.map((cell) => {
                  const link = cell.hasLink ? { textContent: cell.text } : null;
                  const checkbox = cell.hasCheckbox ? { type: "checkbox", checked: false } : null;
                  const button = cell.hasButton ? { textContent: cell.text } : null;
                  
                  return {
                    querySelector: (sel: string) => {
                      if (sel === "a") return link;
                      if (sel === "input[type='checkbox']") return checkbox;
                      if (sel === "button") return button;
                      return null;
                    },
                    textContent: cell.text,
                  };
                });
                return {
                  getAttribute: (attr: string) => (attr === "aria-hidden" && isHidden) ? "true" : null,
                  querySelectorAll: () => mockCells,
                  hidden: false,
                  hasAttribute: () => false,
                  getClientRects: () => [{}],
                };
              });
              return Promise.resolve(fn(mockRowElements as unknown as Element[], headers));
            } finally {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete (globalThis as any).getComputedStyle;
            }
          }),
        };
      }
      throw new Error(`Unexpected selector: ${selector}`);
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
        const table = {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return {
                exists: true,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                querySelectorAll: (_selector: string) => {
                  // Return header cells
                  return config.theadRows[0]?.map((text) => ({
                    innerText: text,
                    textContent: text,
                  })) || [];
                },
              };
            }
            return null;
          },
        };

        // Create thead rows (these should be filtered out!)
        const theadRows = config.theadRows.map((cells) => ({
          querySelectorAll: () => cells.map((text) => ({ innerText: text, textContent: text })),
          hidden: false,
          hasAttribute: () => false,
          getClientRects: () => [{}],
          closest: (sel: string) => {
            if (sel === "table") return table;
            if (sel === "thead") return { exists: true }; // This row is in thead
            return null;
          },
        }));

        // Create tbody rows (these should be returned as data)
        const tbodyRows = config.tbodyRows.map((cells) => ({
          querySelectorAll: () => cells.map((text) => ({ innerText: text, textContent: text })),
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
  return {
    locator: vi.fn().mockImplementation((selector: string) => {
      if (selector === "thead th") {
        return {
          evaluateAll: vi.fn().mockImplementation((fn: (elements: Element[]) => unknown) => {
            const mockThElements = config.headers.map((h) => {
              const button = h.hasButton ? { textContent: h.text } : null;
              return {
                querySelector: () => button,
                textContent: h.text,
              };
            });
            return Promise.resolve(fn(mockThElements as unknown as Element[]));
          }),
        };
      }
      if (selector === "tbody tr") {
        return {
          evaluateAll: vi.fn().mockImplementation((fn: (elements: Element[], headers: string[]) => unknown, headers: string[]) => {
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
              const mockRowElements = config.rows.map((rowConfig) => {
                const mockCells = rowConfig.cells.map((cell) => {
                  const link = cell.hasLink ? { textContent: cell.text } : null;
                  const checkbox = cell.hasCheckbox ? { type: "checkbox", checked: false } : null;
                  const button = cell.hasButton ? { textContent: cell.text } : null;
                  
                  return {
                    querySelector: (sel: string) => {
                      if (sel === "a") return link;
                      if (sel === "input[type='checkbox']") return checkbox;
                      if (sel === "button") return button;
                      return null;
                    },
                    textContent: cell.text,
                  };
                });
                
                return {
                  getAttribute: (attr: string) => {
                    if (attr === "aria-hidden" && rowConfig.hidden && rowConfig.hiddenType === "aria") {
                      return "true";
                    }
                    return null;
                  },
                  querySelectorAll: () => mockCells,
                  hidden: rowConfig.hidden && rowConfig.hiddenType === "display",
                  hasAttribute: (attr: string) => {
                    if (attr === "hidden") return rowConfig.hidden && rowConfig.hiddenType === "display";
                    return false;
                  },
                  getClientRects: () => rowConfig.hidden ? [] : [{}],
                  hiddenType: rowConfig.hiddenType, // Pass to getComputedStyle mock
                };
              });
              
              const result = fn(mockRowElements as unknown as Element[], headers);
              return Promise.resolve(result);
            } finally {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete (globalThis as any).getComputedStyle;
            }
          }),
        };
      }
      throw new Error(`Unexpected selector: ${selector}`);
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
        const tableElement = config.hasThead ? {
          querySelector: (sel: string) => {
            if (sel === "thead") {
              return {
                querySelectorAll: () =>
                  config.headers.map((h) => ({ innerText: h, textContent: h })),
              };
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
            querySelector: (sel: string) => {
              // First cell might have checkbox
              if (sel === "input[type='checkbox']" && rowConfig.hasCheckbox) {
                return { type: "checkbox", checked: false };
              }
              return null;
            },
          }));

          return {
            querySelectorAll: () => cells,
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
