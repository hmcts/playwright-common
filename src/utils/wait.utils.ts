/** Options controlling visibility wait behaviour */
interface WaitOptions {
  visibility?: boolean;
  delay?: number;
  timeout?: number;
}

/** Minimal contract for a locator-like object */
interface VisibilityProbe {
  isVisible(): Promise<boolean>;
}

/** Utility helpers for custom waiting logic where Playwright built-ins aren't suitable */
export class WaitUtils {
  private static readonly DEFAULT_DELAY_MS = 1_000;
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Waits for a given locator to reach the desired visibility.
   *
   * @param locator - Any object exposing Playwright's locator isVisible behaviour
   * @param options {@link WaitOptions} - Additional options
   */
  public async waitForLocatorVisibility(
    locator: VisibilityProbe,
    options: WaitOptions = {}
  ): Promise<void> {
    const desiredVisibility = options.visibility ?? true;
    const delay = options.delay ?? WaitUtils.DEFAULT_DELAY_MS;
    const timeout = options.timeout ?? WaitUtils.DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    // Guard against detached locators by treating errors as non-visible states.
    const currentVisibility = async (): Promise<boolean> => {
      try {
        return await locator.isVisible();
      } catch {
        return false;
      }
    };

    while ((await currentVisibility()) !== desiredVisibility) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > timeout) {
        throw new Error(
          `Timeout (${timeout}ms) exceeded waiting for locator visibility=${desiredVisibility}`
        );
      }
      await WaitUtils.sleep(delay);
    }
  }
}
