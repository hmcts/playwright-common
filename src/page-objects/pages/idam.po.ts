import { Page, Locator } from "@playwright/test";

export interface UserCredentials {
  username: string;
  password: string;
  sessionFile: string;
  cookieName?: string;
}

export class IdamPage {
  readonly page: Locator;
  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitBtn: Locator;

  constructor(page: Page) {
    this.heading = this.page.getByRole("heading", {
      name: "Sign in or create an account",
    });
    this.usernameInput = this.page.locator("#username");
    this.passwordInput = this.page.locator("#password");
    this.submitBtn = this.page.locator('[name="save"]');
  }

  async login(user: UserCredentials): Promise<void> {
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    await this.submitBtn.click();
    await this.saveSession(user);
  }

  private async saveSession(user: UserCredentials) {
    await this.page.context().storageState({ path: user.sessionFile });
  }
}
