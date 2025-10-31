import { Page, expect } from "@playwright/test";

export class ExuiSpinnerComponent {
  constructor(public readonly page: Page) {}

  readonly spinner = this.page.locator("xuilib-loading-spinner");

  public async wait(): Promise<void> {
    await expect
      .poll(
        async () => this.spinner.count(),
        {
          timeout: 60_000,
        }
      )
      .toBe(0);
  }
}
