import { Page } from "@playwright/test";
import { Base } from "../base.js";

export class ExuiCaseDetailsComponent extends Base {
  readonly caseHeader = this.page.locator("ccd-case-header");
  readonly tabs = {
    documentsTab: this.page.getByRole("tab", { name: "Case documents" }),
  };
  readonly documentField = this.page.locator("ccd-read-document-field");

  constructor(page: Page) {
    super(page);
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
