import { Page } from "@playwright/test";

export enum Locale {
  EN = "en",
  CY = "cy",
}

export class LocaleUtils {
  constructor(private page: Page) {}

  /**
   * Opens a new browser context and returns the page
   *
   * @param locale {@link Locale} - enum representing supported locales
   *
   */
  public appendLocaleToUrl(locale: Locale): string {
    const url = this.page.url();
    const lngRegex = new RegExp("\\?lng=");

    const match = url.match(lngRegex);
    if (match) {
      return this.page.url().replace(/\?lng=\w+/, `?lng=${locale}`);
    }
    return this.page.url() + `?lng=${locale}`;
  }

  public async navigateWithLocale(locale: Locale): Promise<void> {
    await this.page.goto(this.appendLocaleToUrl(locale));
  }
}
