import { Locator } from "@playwright/test";

/** Options controlling visibility wait behaviour */
interface WaitOptions {
  visibility: boolean; // Desired visibility state
  delay?: number; // Polling delay in ms (default 1000)
  timeout?: number; // Max time to wait in ms (default 120000)
}

/** Utility helpers for custom waiting logic where Playwright built-ins aren't suitable */
export class WaitUtils {
  private static readonly DEFAULT_DELAY_MS = 1_000;
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Waits for a given locator to become visible
   *
   * @param locator {@link Locator} - The locator to wait for
   * @param options {@link WaitOptions} - Additional options
   *
   */
  public async waitForLocatorVisibility(
    locator: Locator,
    options: WaitOptions
  ): Promise<void> {
  const delay = options.delay ?? WaitUtils.DEFAULT_DELAY_MS;
  const timeout = options.timeout ?? WaitUtils.DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    while ((await locator.isVisible()) !== options.visibility) {
      const elapsedTime = Date.now() - startTime;
      await this.wait(delay);
      if (elapsedTime > timeout) {
        throw new Error(
          `Timeout (${timeout}ms) exceeded waiting for locator visibility=${options.visibility}`
        );
      }
    }
  }
}
