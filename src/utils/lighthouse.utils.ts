import { Page } from "@playwright/test";
import { desktopConfig } from "lighthouse";
import { playAudit } from "playwright-lighthouse";

interface Thresholds {
  performance: number;
  accessibility: number;
  "best-practices": number;
}

export class LighthouseUtils {
  constructor(private lighthousePage: Page, private lighthousePort: number) {}

  private static readonly DEFAULT_THRESHOLDS = {
    performance: 80,
    accessibility: 100,
    "best-practices": 100,
  };

  public async audit(thresholds?: Thresholds): Promise<void> {
    await playAudit({
      // Cast to playwright-core Page to align with lighthouse types
      page: this.lighthousePage as unknown as import("playwright-core").Page,
      thresholds: thresholds ?? LighthouseUtils.DEFAULT_THRESHOLDS,
      port: this.lighthousePort,
      config: desktopConfig,
      reports: {
        formats: {
          html: true,
        },
        name: "lighthouse-report-" + Date.now().toString(),
        directory: "./test-results",
      },
    });
  }
}
