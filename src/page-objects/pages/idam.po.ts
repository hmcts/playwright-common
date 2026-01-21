import { Page } from "@playwright/test";

export interface UserCredentials {
  username: string;
  password: string;
  sessionFile?: string;
  cookieName?: string;
}
export class IdamPage {
  constructor(public readonly page: Page) {}

  // ✅ Good: Using ARIA role (acceptable fallback when test ID unavailable)
  readonly heading = this.page.getByRole("heading", {
    name: "Sign in or create an account",
  });
  
  // TODO(IDAM team): Add data-testid="idam-username-input" - prefer test ID over #id
  readonly usernameInput = this.page.locator("#username");
  
  // TODO(IDAM team): Add data-testid="idam-password-input" - prefer test ID over #id
  readonly passwordInput = this.page.locator("#password");
  
  // TODO(IDAM team): Add data-testid="idam-submit-button" - brittle name attribute selector
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
