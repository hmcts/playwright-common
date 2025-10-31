import { PlaywrightTestProject, devices } from "playwright/test";
import { CommonConfig } from "./common.config.js";

export class ProjectsConfig {
  public static readonly chrome: PlaywrightTestProject = {
    name: "chrome",
    use: {
      ...devices["Desktop Chrome"],
      channel: "chrome",
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static readonly chromium: PlaywrightTestProject = {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static readonly edge: PlaywrightTestProject = {
    name: "edge",
    use: {
      ...devices["Desktop Edge"],
      channel: "msedge",
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static readonly firefox: PlaywrightTestProject = {
    name: "firefox",
    use: {
      ...devices["Desktop Firefox"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static readonly webkit: PlaywrightTestProject = {
    name: "webkit",
    use: {
      ...devices["Desktop Safari"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
      // Disable video & trace for webkit due to slowness
      trace: "off",
      video: "off",
    },
  };

  public static readonly tabletChrome: PlaywrightTestProject = {
    name: "tabletchrome",
    use: { ...devices["Galaxy Tab S4"] },
  };

  public static readonly tabletWebkit: PlaywrightTestProject = {
    name: "tabletwebkit",
    use: { ...devices["iPad Pro 11"] },
  };
}
