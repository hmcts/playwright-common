import { Page, Locator } from "@playwright/test";

export class ExuiCaseDetailsComponent {
  readonly page: Page;
  readonly caseHeader: Locator;
  readonly tabs: Locator;
  readonly documentField: Locator;

  constructor(page: Page) {
    this.caseHeader = this.page.locator("ccd-case-header");
    this.tabs = {
    documentsTab: this.page.getByRole("tab", { name: "Case documents" }),
  };
    this.documentField = this.page.locator("ccd-read-document-field");
  }

  public async getCaseNumber(): Promise<string> {
    const text = await this.caseHeader.textContent();
    const caseNumber = text!.match(/Casenumber: (.*)/);
    if (!caseNumber || !text) {
      throw new Error("Case number not found");
    }
    return caseNumber[1].trim();
  }
}
