import { Locator } from "@playwright/test";

export class TableUtils {
  private static readonly SORT_ICON = "▼";

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

  private async mapTable(
    table: Locator,
    headerTransform?: (h: string) => string
  ): Promise<Record<string, string>[]> {
    await table.scrollIntoViewIfNeeded({ timeout: 30_000 });

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

  private alignCells(cells: string[], headerCount: number): string[] {
    if (cells.length === headerCount) {
      return cells;
    }

    const selectionTrimmed =
      cells.length > headerCount && TableUtils.looksLikeSelectionCell(cells[0])
        ? cells.slice(1)
        : cells;

    if (selectionTrimmed.length > headerCount) {
      return selectionTrimmed.slice(0, headerCount);
    }
    return selectionTrimmed;
  }

  private static looksLikeSelectionCell(text: string): boolean {
    const trimmed = text.trim();
    return trimmed === "" || trimmed === "☐" || trimmed === "☑";
  }
}
