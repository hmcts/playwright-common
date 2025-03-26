import { PlaywrightTestProject, devices } from "playwright/test";
import CommonConfig from "./CommonConfig";

export abstract class Projects {
  public static readonly chrome: PlaywrightTestProject = {
    name: "chrome",
    use: {
      ...devices["Desktop Chrome"],
      channel: "chrome",
      viewport: CommonConfig.DEFAULT_VIEWPORT,
    },
  };
}
