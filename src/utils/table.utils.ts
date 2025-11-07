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
      // include both th and td in body rows
      const cells = row.locator('th, td');
      const cellCount = await cells.count();

      // if there’s an extra unlabeled cell (e.g., checkbox), align from the right
      const offset = Math.max(0, cellCount - headers.length);

      const rowData: Record<string, string> = {};
      for (let j = 0; j < headers.length && j + offset < cellCount; j++) {
        const header = headers[j];
        if (!header) continue;
        const text = (await cells.nth(j + offset).innerText()).trim();
        rowData[header] = text;
      }
      out.push(rowData);
    }
    return out;
  }

}
