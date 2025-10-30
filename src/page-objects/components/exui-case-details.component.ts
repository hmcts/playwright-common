import { Page } from "@playwright/test";

export class ExuiCaseDetailsComponent {
  constructor(public page: Page) {}

  readonly caseHeader = this.page.locator("ccd-case-header");
  readonly caseListContainer = this.page.locator("exui-case-list");
  readonly fullAccessContainer = this.page.locator(
    "ccd-case-full-access-view"
  );
  readonly basicAccessContainer = this.page.locator("ccd-case-basic-access");
  readonly challengedAccessMessage = this.page
    .locator("cut-alert")
    .filter({ hasText: "This case requires challenged access." });
  readonly requestAccessButton = this.page.getByRole("button", {
    name: "Request access",
  });
  readonly cancelLink = this.page.getByRole("link", { name: "Cancel" });
  readonly caseListNavLink = this.page.getByRole("link", { name: "Case list" });
  readonly tabs = {
    documentsTab: this.page.getByRole("tab", { name: "Case documents" }),
  };
  readonly documentField = this.page.locator("ccd-read-document-field");

  public async getCaseNumber(): Promise<string> {
    const text = await this.caseHeader.textContent();
    const caseNumber = text!.match(/Casenumber: (.*)/);
    if (!caseNumber || !text) {
      throw new Error("Case number not found");
    }
    return caseNumber[1].trim();
  }

  /**
   * Wait for the outcome of selecting a case from the list.
   * Returns once either the case details header is visible or the challenged
   * access screen appears.
   */
  public async waitForSelectionOutcome(
    timeout = 10000
  ): Promise<"caseDetails" | "challengedAccess"> {
    const pollIntervalMs = 250;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await this.fullAccessContainer.isVisible()) {
        return "caseDetails";
      }

      if (
        (await this.basicAccessContainer.isVisible()) ||
        (await this.requestAccessButton.isVisible()) ||
        (await this.challengedAccessMessage.isVisible())
      ) {
        return "challengedAccess";
      }

      await this.page.waitForTimeout(pollIntervalMs);
    }

    throw new Error(
      "Timed out waiting for case details or challenged access screen."
    );
  }

  public async returnToCaseList(): Promise<void> {
    await this.page.goBack();
    await this.page.waitForLoadState("domcontentloaded");

    if (await this.caseListContainer.isVisible()) {
      return;
    }

    if (await this.caseListNavLink.isVisible()) {
      await Promise.all([
        this.page.waitForLoadState("domcontentloaded"),
        this.caseListNavLink.click(),
      ]);
      return;
    }

    if (await this.cancelLink.isVisible()) {
      await Promise.all([
        this.page.waitForLoadState("domcontentloaded"),
        this.cancelLink.click(),
      ]);
      return;
    }

    await this.page.goBack();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
