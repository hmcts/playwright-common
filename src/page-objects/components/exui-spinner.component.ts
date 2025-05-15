import { Page, expect, Locator } from "@playwright/test";

export class ExuiSpinnerComponent{
  readonly page: Page;
  readonly spinner: Locator;
  
  constructor(page: Page) {
    this.spinner = this.page.locator("xuilib-loading-spinner");
  }

  async wait() {
    await expect
      .poll(
        async () => {
          const spinnerCount = await this.spinner.count();
          return spinnerCount;
        },
        {
          timeout: 60_000,
        }
      )
      .toBe(0);
  }
}
