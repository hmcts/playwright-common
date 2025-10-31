import { Page } from "@playwright/test";

export interface UserCredentials {
  username: string;
  password: string;
  sessionFile?: string;
  cookieName?: string;
}
export class IdamPage {
  constructor(public readonly page: Page) {}

  readonly heading = this.page.getByRole("heading", {
    name: "Sign in or create an account",
  });
  readonly usernameInput = this.page.locator("#username");
  readonly passwordInput = this.page.locator("#password");
  readonly submitBtn = this.page.locator('[name="save"]');

  public async login(user: UserCredentials): Promise<void> {
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    await this.submitBtn.click();
    if (user.sessionFile) {
      await this.saveSession(user.sessionFile);
    }
  }

  private async saveSession(sessionFile: string): Promise<void> {
    await this.page.context().storageState({ path: sessionFile });
  }
}
