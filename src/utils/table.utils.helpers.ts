const SORT_ICON_PATTERN =
  /[\u25B2\u25BC\u21E7\u21E9\u2BC5\u2BC6\u2191\u2193]/g;
const INVISIBLE_CHAR_PATTERN = /[\u200B\uFEFF]/g;

export type TableCellSnapshot = {
  rawText: string;
  colSpan: number;
  rowSpan: number;
  isHeader: boolean;
  linkText?: string;
  buttonText?: string;
};

export type TableRowSnapshot = {
  cells: TableCellSnapshot[];
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

export type TableSnapshot = {
  rows: TableRowSnapshot[];
  hasThead: boolean;
};

type ExpandOptions = {
  preferLinkButton?: boolean;
};

export function cleanTableText(text: string): string {
  return text
    .replaceAll(SORT_ICON_PATTERN, "")
    .replaceAll(INVISIBLE_CHAR_PATTERN, "")
    .trim()
    .replaceAll(/\s+/g, " ");
}

export function filterVisibleRows(rows: TableRowSnapshot[]): TableRowSnapshot[] {
  return rows.filter(
    (row) => row.isVisible && !row.isAriaHidden && !row.isHiddenAttr
  );
}

export function looksLikeSelectionCellText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || trimmed === "☐" || trimmed === "☑";
}

function ensureRowArrays(
  grid: string[][],
  occupied: boolean[][],
  rowIndex: number
): void {
  grid[rowIndex] ??= [];
  occupied[rowIndex] ??= [];
}

function fillGridCell(
  grid: string[][],
  occupied: boolean[][],
  rowIndex: number,
  colIndex: number,
  cell: TableCellSnapshot
): number {
  let currentCol = colIndex;
  const occupiedRow = occupied[rowIndex];
  if (occupiedRow) {
    while (occupiedRow[currentCol]) currentCol++;
  }

  const text = cleanTableText(cell.rawText);
  const colSpan = Math.max(cell.colSpan || 1, 1);
  const rowSpan = Math.max(cell.rowSpan || 1, 1);

  for (let r = 0; r < rowSpan; r++) {
    const targetRow = rowIndex + r;
    grid[targetRow] ??= [];
    occupied[targetRow] ??= [];
    for (let c = 0; c < colSpan; c++) {
      const targetCol = currentCol + c;
      const gridRow = grid[targetRow];
      if (gridRow && !gridRow[targetCol]) {
        gridRow[targetCol] = text;
      }
      const occupiedTargetRow = occupied[targetRow];
      if (occupiedTargetRow) {
        occupiedTargetRow[targetCol] = true;
      }
    }
  }

  return currentCol + colSpan;
}

function buildHeaderGrid(
  headerRows: TableRowSnapshot[]
): { grid: string[][]; maxColumns: number } {
  const grid: string[][] = [];
  const occupied: boolean[][] = [];
  let maxColumns = 0;

  headerRows.forEach((row, rowIndex) => {
    ensureRowArrays(grid, occupied, rowIndex);
    let colIndex = 0;

    for (const cell of row.cells) {
      colIndex = fillGridCell(grid, occupied, rowIndex, colIndex, cell);
      maxColumns = Math.max(maxColumns, colIndex);
    }
  });

  return { grid, maxColumns };
}

export function buildHeaderKeys(headerRows: TableRowSnapshot[]): string[] {
  if (!headerRows || headerRows.length === 0) return [];

  const { grid, maxColumns } = buildHeaderGrid(headerRows);
  const headers: string[] = [];

  for (let col = 0; col < maxColumns; col++) {
    const parts: string[] = [];
    for (const row of grid) {
      const part = row?.[col];
      if (part && !parts.includes(part)) {
        parts.push(part);
      }
    }
    headers.push(parts.join(" ").trim());
  }
  return headers;
}

function resolveCellText(
  cell: TableCellSnapshot,
  options?: ExpandOptions
): string {
  if (options?.preferLinkButton) {
    if (cell.linkText !== undefined) {
      return cleanTableText(cell.linkText);
    }
    if (cell.buttonText !== undefined) {
      return cleanTableText(cell.buttonText);
    }
  }
  return cleanTableText(cell.rawText);
}

function expandCells(row: TableRowSnapshot, options?: ExpandOptions): string[] {
  const values: string[] = [];
  for (const cell of row.cells) {
    const text = resolveCellText(cell, options);
    const colSpan = Math.max(cell.colSpan || 1, 1);
    for (let i = 0; i < colSpan; i++) {
      values.push(text);
    }
  }
  return values;
}

function alignCells(cells: string[], headerCount: number): string[] {
  if (cells.length === headerCount) {
    return cells;
  }

  const firstCell = cells[0];
  const selectionTrimmed =
    cells.length > headerCount &&
    firstCell !== undefined &&
    looksLikeSelectionCellText(firstCell)
      ? cells.slice(1)
      : cells;

  if (selectionTrimmed.length > headerCount) {
    return selectionTrimmed.slice(0, headerCount);
  }
  if (selectionTrimmed.length < headerCount) {
    return selectionTrimmed.concat(
      Array.from({ length: headerCount - selectionTrimmed.length }, () => "")
    );
  }
  return selectionTrimmed;
}

function isNonDataRow(row: TableRowSnapshot, headerCount: number): boolean {
  if (row.hasActionsRowClass || row.hasFooterRowClass) {
    return true;
  }
  if (row.hasActionsCell || row.hasFooterCell) {
    return true;
  }

  if (headerCount > 1 && row.cells.length === 1) {
    if (row.totalColSpan >= headerCount) {
      return true;
    }
  }

  return false;
}

export function parseKeyValueSnapshot(
  snapshot: TableSnapshot
): Record<string, string> {
  const result: Record<string, string> = {};
  const rows = filterVisibleRows(snapshot.rows);

  for (const row of rows) {
    const cells = row.cells;
    if (cells.length < 2) continue;

    const keyCell = cells[0];
    if (!keyCell) continue;
    const key = cleanTableText(keyCell.rawText);
    if (!key) {
      throw new Error("Failed to extract text from visible key cell");
    }

    const values = cells.slice(1).map((cell) => cleanTableText(cell.rawText));
    result[key] = values.join(" ").replaceAll(/\s+/g, " ").trim();
  }

  return result;
}

export function parseDataSnapshot(
  snapshot: TableSnapshot
): Array<Record<string, string>> {
  if (!snapshot.rows.length) return [];

  const nonTheadRows = snapshot.rows.filter((row) => !row.isTheadRow);
  const hasThead =
    snapshot.hasThead || snapshot.rows.some((row) => row.isTheadRow);
  let headerRows: TableRowSnapshot[] = [];
  let dataRows: TableRowSnapshot[] = [];

  if (hasThead) {
    headerRows = snapshot.rows.filter((row) => row.isTheadRow);
    dataRows = nonTheadRows;
  } else {
    const headerCandidate = nonTheadRows[0];
    const headerHasTh =
      headerCandidate?.cells.some((cell) => cell.isHeader) ?? false;
    if (headerCandidate && headerHasTh) {
      headerRows = [headerCandidate];
      dataRows = nonTheadRows.slice(1);
    } else {
      headerRows = [];
      dataRows = nonTheadRows;
    }
  }

  const headers = buildHeaderKeys(headerRows);
  const visibleRows = filterVisibleRows(dataRows);
  const result: Array<Record<string, string>> = [];

  for (const row of visibleRows) {
    const cellValues = expandCells(row);
    if (!cellValues.length) continue;

    const rowData: Record<string, string> = {};
    for (let i = 0; i < cellValues.length; i++) {
      const header = headers[i];
      const key = header?.trim() || `column_${i + 1}`;
      rowData[key] = cellValues[i] ?? "";
    }
    result.push(rowData);
  }

  return result;
}

export function parseWorkAllocationSnapshot(
  snapshot: TableSnapshot
): Array<Record<string, string>> {
  if (!snapshot.rows.length) return [];

  const theadRows = snapshot.rows.filter((row) => row.isTheadRow);
  let headerRows = theadRows;
  let dataRows = snapshot.rows.filter((row) => !row.isTheadRow);

  if (headerRows.length === 0 && dataRows.length > 0) {
    const headerCandidate = dataRows[0];
    const headerHasTh = headerCandidate?.cells.some((cell) => cell.isHeader) ?? false;
    if (headerCandidate && headerHasTh) {
      headerRows = [headerCandidate];
      dataRows = dataRows.slice(1);
    }
  }

  const headers = buildHeaderKeys(headerRows);
  const maxCellCount = dataRows.reduce(
    (max, row) => Math.max(max, row.totalColSpan),
    0
  );
  const headerKeys =
    headers.length > 0
      ? headers
      : Array.from({ length: maxCellCount }, (_value, index) => `column_${index + 1}`);
  const headerCount = headerKeys.length;

  if (headerCount === 0) {
    return [];
  }

  const candidateRows = dataRows.filter(
    (row) => !isNonDataRow(row, headerCount)
  );
  const visibleRows = filterVisibleRows(candidateRows);
  const result: Array<Record<string, string>> = [];

  for (const row of visibleRows) {
    const cellValues = expandCells(row, { preferLinkButton: true });
    if (!cellValues.length) continue;

    const alignedCells = alignCells(cellValues, headerCount);
    const rowData: Record<string, string> = {};

    for (let j = 0; j < headerCount; j++) {
      const header = headerKeys[j];
      const key = header?.trim() || `column_${j + 1}`;
      rowData[key] = alignedCells[j] ?? "";
    }

    result.push(rowData);
  }

  return result;
}
