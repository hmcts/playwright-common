import { Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdamPage, UserCredentials } from "../../src/page-objects/pages/idam.po.js";

describe("IdamPage.login", () => {
  const user: UserCredentials = {
    username: "user@example.com",
    password: "secret",
  };

  const usernameInput = {
    fill: vi.fn(),
  };
  const passwordInput = {
    fill: vi.fn(),
    isVisible: vi.fn(),
    waitFor: vi.fn(),
  };
  const visibleSubmitBtn = {
    click: vi.fn(),
  };
  const submitBtn = {
    filter: vi.fn(() => visibleSubmitBtn),
  };
  const storageState = vi.fn();

  const page = {
    getByRole: vi.fn(() => ({})),
    locator: vi.fn((selector: string) => {
      if (selector.includes("idam-username-input")) {
        return usernameInput;
      }
      if (selector.includes("idam-password-input")) {
        return passwordInput;
      }
      return submitBtn;
    }),
    context: vi.fn(() => ({ storageState })),
  } as unknown as Page;

  let idamPage: IdamPage;

  beforeEach(() => {
    vi.clearAllMocks();
    idamPage = new IdamPage(page);
  });

  it("submits once when username and password are shown together", async () => {
    passwordInput.isVisible.mockResolvedValue(true);

    await idamPage.login(user);

    expect(usernameInput.fill).toHaveBeenCalledWith(user.username);
    expect(passwordInput.waitFor).not.toHaveBeenCalled();
    expect(passwordInput.fill).toHaveBeenCalledWith(user.password);
    expect(visibleSubmitBtn.click).toHaveBeenCalledTimes(1);
  });

  it("submits each stage when the password is shown after the username", async () => {
    passwordInput.isVisible.mockResolvedValue(false);

    await idamPage.login(user);

    expect(visibleSubmitBtn.click).toHaveBeenCalledTimes(2);
    expect(passwordInput.waitFor).toHaveBeenCalledWith({ state: "visible" });
    expect(passwordInput.fill).toHaveBeenCalledWith(user.password);
    expect(passwordInput.waitFor).toHaveBeenCalledBefore(passwordInput.fill);
  });

  it("stores the session after submitting the login form", async () => {
    passwordInput.isVisible.mockResolvedValue(true);

    await idamPage.login({ ...user, sessionFile: "session.json" });

    expect(storageState).toHaveBeenCalledWith({ path: "session.json" });
    expect(visibleSubmitBtn.click).toHaveBeenCalledBefore(storageState);
  });
});
