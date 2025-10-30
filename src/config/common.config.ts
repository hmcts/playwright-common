import { PlaywrightTestConfig } from "playwright/test";

function resolveWorkers(): number {
  if (!process.env.CI) {
    return 4;
  }
  const configured = Number.parseInt(
    process.env.FUNCTIONAL_TESTS_WORKERS ?? "",
    10
  );
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }
  return 4;
}

export class CommonConfig {
  public static readonly DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

  public static readonly recommended: PlaywrightTestConfig = {
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* This timeout should match whatever your longest test takes with slight leeway for app performance */
    timeout: 3 * 60 * 1000,
    /* The default timeout for assertions is 5s, it's not advised to increase this massively.
     If you need to, you can add a timeout to a specific assertion e.g. await page.goto('https://playwright.dev', { timeout: 30000 }); */
    expect: { timeout: 10000 },
    /* As we're using shared environments, it's not suggested to raise worker numbers above 4. */
    workers: resolveWorkers(),
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: process.env.CI ? [["html"], ["list"]] : [["list"]],
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. - can also be applied per project */
    use: {
      /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
      trace: "retain-on-failure",
      video: "retain-on-failure",
      screenshot: "only-on-failure",
    },
  };
}
