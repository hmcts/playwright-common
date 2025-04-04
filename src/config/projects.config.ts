import { PlaywrightTestProject, devices } from "playwright/test";
import { CommonConfig } from "./common.config.js";

export class ProjectsConfig {
  public static chrome: PlaywrightTestProject = {
    name: "chrome",
    use: {
      ...devices["Desktop Chrome"],
      channel: "chrome",
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static chromium: PlaywrightTestProject = {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static edge: PlaywrightTestProject = {
    name: "edge",
    use: {
      ...devices["Desktop Edge"],
      channel: "msedge",
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static firefox: PlaywrightTestProject = {
    name: "firefox",
    use: {
      ...devices["Desktop Firefox"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };

  public static webkit: PlaywrightTestProject = {
    name: "webkit",
    use: {
      ...devices["Desktop Safari"],
      viewport: CommonConfig.DEFAULT_VIEWPORT,
      // Disable video & trace for webkit due to slowness
      trace: "off",
      video: "off",
    },
  };

  public static tabletChrome: PlaywrightTestProject = {
    name: "tabletchrome",
    use: { ...devices["Galaxy Tab S4"] },
  };

  public static tabletWebkit: PlaywrightTestProject = {
    name: "tabletwebkit",
    use: { ...devices["iPad Pro 11"] },
  };
}
