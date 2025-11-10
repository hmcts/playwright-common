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
    headerTransform?: (header: string) => string
  ): Promise<Record<string, string>[]> {
    await table.scrollIntoViewIfNeeded({ timeout: 30_000 });

    const tableData: Record<string, string>[] = [];
    const headers = (
      await table.locator("thead th").allInnerTexts()
    ).map((header) => (headerTransform ? headerTransform(header) : header));
    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const rowData: Record<string, string> = {};
      const cells = rows.nth(i).locator("td");

      const cellCount = await cells.count();
      for (let j = 0; j < cellCount; j++) {
        const header = headers[j];
        const cell = cells.nth(j);
        rowData[header] = (await cell.innerText()).trim();
      }
      tableData.push(rowData);
    }

    return tableData;
  }
}
