import { Page } from "@playwright/test";

export enum Locale {
  EN = "en",
  CY = "cy",
}

export class LocaleUtils {
  constructor(private page: Page) {}

  /**
   * Takes a locale and appends it to the current URL, or if a locale is already present it is replaced.
   *
   * @param locale {@link Locale} - enum representing supported locales
  *
   */
  public appendLocaleToUrl(locale: Locale): string {
    const currentUrl = new URL(this.page.url());
    currentUrl.searchParams.set("lng", locale);
    return currentUrl.toString();
  }

  public async navigateWithLocale(locale: Locale): Promise<void> {
    await this.page.goto(this.appendLocaleToUrl(locale));
  }
}
