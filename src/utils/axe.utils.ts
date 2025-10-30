import { AxeBuilder } from "@axe-core/playwright";
import { Page, expect, TestInfo } from "@playwright/test";
import { createHtmlReport } from "axe-html-reporter";
import { createLogger, createChildLogger } from "../logging/logger.js";

interface AuditOptions {
  exclude?: string | string[];
  include?: string | string[];
  disableRules?: string | string[];
}

interface AxeAuditResult {
  url: string;
  results: Awaited<ReturnType<AxeBuilder["analyze"]>>;
}

export class AxeUtils {
  private readonly DEFAULT_TAGS = [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22a",
    "wcag22aa",
  ];

  private resultsList: AxeAuditResult[] = [];

  private readonly logger = createChildLogger(createLogger(), { component: "axe" });

  constructor(protected readonly page: Page) {}

  private applySelectors(
    builder: AxeBuilder,
    method: "exclude" | "include",
    selectors?: string | string[]
  ) {
    if (!selectors) return;
    const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorsArray) {
      builder[method](selector);
    }
  }

  /**
   * Run the AxeBuilder checks using the pre-determined tags
   *
   * @param options {@link AuditOptions} - Optional config such as excluding element(s)
   *
   */
  public async audit(options?: AuditOptions) {
    const start = Date.now();
    const builder = new AxeBuilder({ page: this.page }).withTags(this.DEFAULT_TAGS);
    this.applySelectors(builder, "exclude", options?.exclude);
    this.applySelectors(builder, "include", options?.include);

    if (options?.disableRules) builder.disableRules(options.disableRules);
    const results = await builder.analyze();
    this.resultsList.push({ url: this.page.url(), results });

    const durationMs = Date.now() - start;
    if (process.env.PWDEBUG) {
      this.logger.info("Accessibility audit completed", {
        url: this.page.url(),
        durationMs,
        violationCount: results.violations.length,
      });
      if (results.violations.length > 0) {
        this.logger.warn("Accessibility issues detected", {
          url: this.page.url(),
          durationMs,
          violationCount: results.violations.length,
          violations: results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => n.html),
          })),
        });
      }
    }

    expect.soft(results.violations).toEqual([]);
  }

  /**
   * Generate a consolidated HTML report of all accessibility results
   * This will be attached to the test info for easy access
   *
   * @param testInfo - Playwright TestInfo object to attach the report
   * @param reportName - Optional name for the report file
   */
  public async generateReport(testInfo: TestInfo, reportName?: string) {
    if (this.resultsList.length === 0) return;

    // Combine all results into one HTML report
    const htmlSections = this.resultsList.map(({ url, results }, idx) => {
      const urlEndpoint = url.split('/').slice(-3).join('/');
      const unique = `_${idx}`;
      let htmlReport = createHtmlReport({
        results,
        options: {
          projectKey: `${urlEndpoint}`,
          doNotCreateReportFile: true,
        },
      });

      htmlReport = this.getUpdatedHtmlReport(htmlReport, unique);

      const reportFileName = (results.violations.length > 0 ? "FAILED " : "") + urlEndpoint;
      return `
      <details>
        <summary><strong>Page ${idx + 1}: ${reportFileName}</strong></summary>
        ${htmlReport}
      </details>
    `;
    });

    const reportStart = Date.now();
    const consolidatedHtml = `
        <html>
          <head>
          <title>Consolidated Accessibility Report</title>
          <style>
            details { margin-bottom: 1em; }
            summary { cursor: pointer; font-size: 1.1em; }
          </style>
        </head>
          <body>
            <h1>Consolidated Accessibility Report</h1>
            ${htmlSections.join('<hr/>')}
          </body>
        </html>
      `;

    await testInfo.attach(reportName ?? 'Consolidated Accessibility Report', {
      body: consolidatedHtml,
      contentType: 'text/html',
    });
    const reportDurationMs = Date.now() - reportStart;
    this.logger.info("Accessibility consolidated report attached", {
      pages: this.resultsList.length,
      pagesWithViolations: this.resultsList.filter(r => r.results.violations.length > 0).length,
      generationDurationMs: reportDurationMs,
      reportName: reportName ?? 'Consolidated Accessibility Report'
    });
    this.resultsList = []; // reset for next test
  }

  private getUpdatedHtmlReport(htmlReport: string, unique: string) {
    // eslint-disable-next-line prefer-string-replace-all -- multi-chain readability acceptable here
    return htmlReport
      .replaceAll('id="accordionPasses"', `id="accordionPasses${unique}"`)
      .replaceAll('id="headingOne"', `id="headingOne${unique}"`)
      .replaceAll('data-target="#passes"', `data-target="#passes${unique}"`)
      .replaceAll('aria-controls="#passes"', `aria-controls="#passes${unique}"`)
      .replaceAll('id="passes"', `id="passes${unique}"`)
      .replaceAll('aria-labelledby="headingOne"', `aria-labelledby="headingOne${unique}"`)
      .replaceAll('id="accordionIncomplete"', `id="accordionIncomplete${unique}"`)
      .replaceAll('id="headingTwo"', `id="headingTwo${unique}"`)
      .replaceAll('data-target="#incomplete"', `data-target="#incomplete${unique}"`)
      .replaceAll('aria-controls="#incomplete"', `aria-controls="#incomplete${unique}"`)
      .replaceAll('id="incomplete"', `id="incomplete${unique}"`)
      .replaceAll('aria-labelledby="headingTwo"', `aria-labelledby="headingTwo${unique}"`)
      .replaceAll('id="accordionInapplicable"', `id="accordionInapplicable${unique}"`)
      .replaceAll('id="headingThree"', `id="headingThree${unique}"`)
      .replaceAll('data-target="#inapplicable"', `data-target="#inapplicable${unique}"`)
      .replaceAll('aria-controls="#inapplicable"', `aria-controls="#inapplicable${unique}"`)
      .replaceAll('id="inapplicable"', `id="inapplicable${unique}"`)
      .replaceAll('aria-labelledby="headingThree"', `aria-labelledby="headingThree${unique}"`)
      .replaceAll('id="rulesSection"', `id="rulesSection${unique}"`)
      .replaceAll('id="ruleSection"', `id="ruleSection${unique}"`)
      .replaceAll('data-target="#rules"', `data-target="#rules${unique}"`)
      .replaceAll('aria-controls="#rules"', `aria-controls="#rules${unique}"`)
      .replaceAll('id="rules"', `id="rules${unique}"`)
      .replaceAll('aria-labelledby="ruleSection"', `aria-labelledby="ruleSection${unique}"`)
      .replaceAll('data-parent="#accordionPasses"', `data-parent="#accordionPasses${unique}"`)
      .replaceAll('data-parent="#accordionIncomplete"', `data-parent="#accordionIncomplete${unique}"`)
      .replaceAll('data-parent="#accordionInapplicable"', `data-parent="#accordionInapplicable${unique}"`)
      .replaceAll('data-parent="#rules"', `data-parent="#rules${unique}"`);
  }
}
