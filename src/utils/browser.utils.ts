import {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test";

export class BrowserUtils {
  constructor(protected readonly browser: Browser) {}

  /**
   * Opens a new browser context and returns the page
   *
   * @param sessionFile {@link string} - optionally provide a session file to use in the new browser context
   *
   */
  public async openNewBrowserContext(sessionFile?: string): Promise<Page> {
    const contextOptions: BrowserContextOptions = {};
    if (sessionFile) {
      contextOptions.storageState = sessionFile;
    }
    const context: BrowserContext = await this.browser.newContext(
      contextOptions
    );
    return context.newPage();
  }
}
