import { Page } from "@playwright/test";

/** Outcome values for waiting on a case selection */
export enum CaseSelectionOutcome {
  CaseDetails = "caseDetails",
  ChallengedAccess = "challengedAccess",
}

/**
 * Page object for interacting with EXUI case details pages.
 * Encapsulates navigational helpers, visibility checks and data extraction utilities.
 */
export class ExuiCaseDetailsComponent {
  constructor(public readonly page: Page) {}

  // Locators
  readonly caseHeader = this.page.locator(
    '[data-testid="case-header"], ccd-case-header'
  );

  readonly caseListContainer = this.page.locator(
    '[data-testid="case-list-container"], #search-result'
  );

  readonly fullAccessContainer = this.page.locator(
    '[data-testid="full-access-container"], ccd-case-full-access-view#content'
  );

  readonly basicAccessContainer = this.page.locator(
    '[data-testid="basic-access-container"], ccd-case-basic-access-view#content'
  );

  readonly challengedAccessMessage = this.page.locator(
    '[data-testid="challenged-access-alert"], ccd-case-challenged-access-request cut-alert[type="information"]'
  );
  
  // ✅ Good: Using ARIA role (acceptable fallback when test ID unavailable)
  readonly requestAccessButton = this.page.getByRole("button", { name: "Request access" });
  
  // ✅ Good: Using ARIA role (acceptable fallback when test ID unavailable)
  readonly cancelLink = this.page.getByRole("link", { name: "Cancel" });
  
  // ✅ Good: Using ARIA role (acceptable fallback when test ID unavailable)
  readonly caseListNavLink = this.page.getByRole("link", { name: "Case list" });
  
  readonly tabs = {
    // ✅ Good: Using ARIA role (acceptable fallback when test ID unavailable)
    documentsTab: this.page.getByRole("tab", { name: "Case documents" }),
  } as const;
  
  readonly documentField = this.page.locator(
    '[data-testid="document-field"], ccd-read-document-field button.govuk-js-link'
  );

  // Constants
  private static readonly CASE_NUMBER_REGEX = /Casenumber:\s*(.+)/i;
  private static readonly DEFAULT_SELECTION_TIMEOUT_MS = 10_000;
  private static readonly SELECTION_POLL_INTERVAL_MS = 250;

  /**
   * Extract the case number from the header text.
   * @throws Error if the header is missing or the case number pattern is not found.
   */
  public async getCaseNumber(): Promise<string> {
    const text = await this.caseHeader.textContent();
    if (!text) {
      throw new Error("Case header text not found");
    }
    const match = ExuiCaseDetailsComponent.CASE_NUMBER_REGEX.exec(text);
    const group = match?.[1];
    if (!group) {
      throw new Error("Case number not found in header");
    }
    return group.trim();
  }

  /**
   * Wait for the outcome of selecting a case from the list.
   * Returns once either the case details view is visible or a challenged access UI appears.
   * @param timeoutMs Maximum time to wait in milliseconds (default 10s)
   * @throws Error if nothing becomes visible within the timeout.
   */
  public async waitForSelectionOutcome(
    timeoutMs: number = ExuiCaseDetailsComponent.DEFAULT_SELECTION_TIMEOUT_MS
  ): Promise<CaseSelectionOutcome> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.fullAccessContainer.isVisible()) {
        return CaseSelectionOutcome.CaseDetails;
      }
      if (
        (await this.basicAccessContainer.isVisible()) ||
        (await this.requestAccessButton.isVisible()) ||
        (await this.challengedAccessMessage.isVisible())
      ) {
        return CaseSelectionOutcome.ChallengedAccess;
      }
      await this.page.waitForTimeout(
        ExuiCaseDetailsComponent.SELECTION_POLL_INTERVAL_MS
      );
    }
    throw new Error(
      "Timed out waiting for case details or challenged access screen to become visible"
    );
  }

  /** Convenience helper for waiting until DOM content is loaded */
  private async waitDomLoaded(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Attempt to navigate back to the case list view.
   * Tries a simple back navigation first; if unsuccessful uses visible navigation elements.
   */
  public async returnToCaseList(): Promise<void> {
    await this.page.goBack();
    await this.waitDomLoaded();

    if (await this.caseListContainer.isVisible()) return;

    // Prefer explicit navigation link if available
    if (await this.caseListNavLink.isVisible()) {
      await Promise.all([this.waitDomLoaded(), this.caseListNavLink.click()]);
      return;
    }

    // Fall back to cancel link flow
    if (await this.cancelLink.isVisible()) {
      await Promise.all([this.waitDomLoaded(), this.cancelLink.click()]);
      return;
    }

    // Final attempt: one more back navigation
    await this.page.goBack();
    await this.waitDomLoaded();
  }
}
