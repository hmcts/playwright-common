import { expect } from "@playwright/test";

export class ValidatorUtils {
  /**
   * Validate a case number is made of only digits
   *
   * @param caseNumber {@link string} - the case number
   *
   */
  public static validateCaseNumber(caseNumber: string) {
  // Case number specification not yet formalised (EXUI-0000). Current rule: digits only.
    expect(caseNumber).toMatch(/^\d+$/);
  }

  /**
   * Validates a given date in the format of "18 Oct 2024"
   * and ensures the date can be parsed
   *
   * @param caseNumber {@link string} - the case number
   *
   */
  public static validateDate(date: string) {
    const dateRegex = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
    expect(date).toMatch(dateRegex);
    const parsed = new Date(date);
    // Ensure parsed date components align with input (guards against e.g. invalid date becoming NaN or different month)
    expect(parsed.toString()).not.toContain("Invalid Date");
  }
}
