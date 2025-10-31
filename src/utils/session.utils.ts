import { Cookie } from "@playwright/test";
import * as fs from "fs";

export class SessionUtils {
  private static readonly SAFE_EXPIRY_WINDOW_MS = 2 * 60 * 60 * 1_000;

  private constructor() {
    // Utility class; prevent instantiation.
  }

  /**
   * Returns JSON-parsed cookies from a given file
   *
   * @param filepath {@link string} - path of the cookie file
   *
   */
  public static getCookies(filepath: string): Cookie[] {
    try {
      const data = fs.readFileSync(filepath, "utf8");
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed?.cookies)) {
        throw new Error("cookies property missing or invalid");
      }
      return parsed.cookies as Cookie[];
    } catch (error) {
      throw new Error(
        `Could not read cookies from ${filepath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Opens a new browser context and returns the page
   *
   * @param path {@link string} - path of the session file
   * @param cookieName {@link string} - name of the cookie used for session validation
   *
   */
  public static isSessionValid(path: string, cookieName: string): boolean {
    if (!fs.existsSync(path)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(path, "utf-8"));
      const cookies = Array.isArray(data?.cookies) ? data.cookies : [];
      const targetCookie = cookies.find(
        (cookie: Cookie) => cookie.name === cookieName
      );

      if (!targetCookie || typeof targetCookie.expires !== "number") {
        return false;
      }

      const expiryMs = targetCookie.expires * 1_000;
      if (!Number.isFinite(expiryMs)) {
        return false;
      }

      return expiryMs - Date.now() > SessionUtils.SAFE_EXPIRY_WINDOW_MS;
    } catch (error) {
      throw new Error(
        `Could not read session data from ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
