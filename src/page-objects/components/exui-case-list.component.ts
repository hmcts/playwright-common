import { Page, Locator } from "@playwright/test";
import { ExuiSpinnerComponent } from "./exui-spinner.component.js";

export class ExuiCaseListComponent {
  readonly page: Page;
  readonly caseList: Locator;
  readonly caseListTable: Locator;
  readonly filters: Locator;
  readonly resultLinks: Locator;
  readonly spinnerComponent: Locator;

  constructor(page: Page) {
    this.caseList = page.locator("exui-case-list");
    this.caseListTable = page.locator("#search-result table");
    this.filters = {
      caseNameFilter: page.locator("#applicantCaseName"),
      caseNumberFilter: page.locator("#\\[CASE_REFERENCE\\]"),
      caseStateFilter: page.locator("select#wb-case-state"),
      applyFilterBtn: page.getByTitle("Apply filter"),
    };
    this.resultLinks = page.locator("ccd-search-result .govuk-link");
    this.spinnerComponent = new ExuiSpinnerComponent(page);
  }

  public async searchByCaseName(caseName: string): Promise<void> {
    await this.filters.caseNameFilter.fill(caseName);
    await this.filters.applyFilterBtn.click();
    await this.spinnerComponent.wait();
  }

  public async searchByCaseNumber(caseNumber: string): Promise<void> {
    await this.filters.caseNumberFilter.fill(caseNumber);
    await this.filters.applyFilterBtn.click();
    await this.spinnerComponent.wait();
  }

  public async searchByCaseState(state: string) {
    await this.filters.caseStateFilter.selectOption(state);
    await this.filters.applyFilterBtn.click();
    await this.spinnerComponent.wait();
  }

  public async selectCaseByIndex(index: number) {
    await this.resultLinks.nth(index).click();
    await this.spinnerComponent.wait();
  }
}
