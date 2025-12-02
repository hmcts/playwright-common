import { expect } from "@playwright/test";

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export class ValidatorUtils {
  /**
   * Validate a case number is made of only digits
   *
   * @param caseNumber {@link string} - the case number
   *
   */
  public static validateCaseNumber(caseNumber: string): void {
    // Case number specification not yet formalised (EXUI-0000). Current rule: digits only.
    expect(caseNumber).toMatch(/^\d+$/);
  }

  /**
   * Validates a given date in the format of "18 Oct 2024"
   * and ensures the date can be parsed
   *
   * @param date {@link string} - the date as displayed in EXUI
   *
   */
  public static validateDate(date: string): void {
    const dateRegex = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
    expect(date).toMatch(dateRegex);
    const parts = date.split(" ");
    if (parts.length < 3) {
      throw new Error("Invalid date string format");
    }
    const [dayStr, monthStr, yearStr] = parts as [string, string, string];
    const day = Number.parseInt(dayStr, 10);
    const monthIndex = MONTH_INDEX[monthStr];
    const year = Number.parseInt(yearStr, 10);

    expect(day).not.toBeNaN();
    expect(year).not.toBeNaN();
    expect(monthIndex).not.toBeUndefined();

    const parsed = new Date(Date.UTC(year, monthIndex, day));

    // Ensure parsed date components align with input (guards against e.g. 31 Jun rolling into July)
    expect(parsed.getUTCDate()).toBe(day);
    expect(parsed.getUTCMonth()).toBe(monthIndex);
    expect(parsed.getUTCFullYear()).toBe(year);
  }
}
