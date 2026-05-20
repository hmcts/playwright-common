import type { Page } from "@playwright/test";

export interface CcdPageClientOptions {
  /** Default: true */
  experimental?: boolean;
  /** Default: 3 */
  maxRetries?: number;
  /** Default: 1000ms */
  retryDelayMs?: number;
}

type StartEventArg = {
  url: string;
  headers: Record<string, string>;
};

type SubmitEventArg = {
  url: string;
  headers: Record<string, string>;
  payload: unknown;
};

export class CcdPageClient {
  private readonly experimental: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options?: CcdPageClientOptions) {
    this.experimental = options?.experimental ?? true;
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  /**
   * Starts a case event using the browser session context (cookies/XSRF).
   * Matches the working pattern used by many Manage Case UI tests.
   */
  async startEvent(page: Page, caseId: string, eventId: string): Promise<string> {
    const url = `/data/internal/cases/${caseId}/event-triggers/${eventId}?ignore-warning=false`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.uk.gov.hmcts.ccd-data-store-api.ui-start-event-trigger.v2+json;charset=UTF-8",
      "Content-Type": "application/json; charset=UTF-8",
    };
    if (this.experimental) headers.Experimental = "true";

    return await this.retry(async () => {
      // Use typed evaluate to avoid `any`.
      return await page.evaluate<string, StartEventArg>(
        async ({ url, headers }: StartEventArg) => {
          const res = await fetch(url, { method: "GET", headers, credentials: "same-origin" });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }
          const json = await res.json();
          if (!json?.event_token) throw new Error(`Missing event_token in response: ${JSON.stringify(json)}`);
          return json.event_token as string;
        },
        { url, headers } as StartEventArg,
      );
    });
  }

  /**
   * Submits an event using the browser session context (cookies/XSRF).
   * Returns the case id from the response.
   */
  async submitEvent(
    page: Page,
    caseId: string,
    eventId: string,
    eventToken: string,
    data: unknown,
    ignoreWarning = false,
  ): Promise<string> {
    const url = `/data/cases/${caseId}/events`;

    const payload = {
      data,
      event: { id: eventId, summary: "", description: "" },
      event_token: eventToken,
      ignore_warning: ignoreWarning,
    };

    const headers: Record<string, string> = {
      Accept: "application/vnd.uk.gov.hmcts.ccd-data-store-api.create-event.v2+json;charset=UTF-8",
      "Content-Type": "application/json; charset=UTF-8",
    };
    if (this.experimental) headers.Experimental = "true";

    return await this.retry(async () => {
      return await page.evaluate<string, SubmitEventArg>(
        async ({ url, headers, payload }: SubmitEventArg) => {
          const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), credentials: "same-origin" });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }
          const json = await res.json();
          if (!json?.id) throw new Error(`Missing id in response: ${JSON.stringify(json)}`);
          return json.id as string;
        },
        { url, headers, payload } as SubmitEventArg,
      );
    });
  }

  /**
   * Convenience: start + submit.
   */
  async createEvent(
    page: Page,
    caseId: string,
    eventId: string,
    data: unknown,
    ignoreWarning = false,
  ): Promise<string> {
    const token = await this.startEvent(page, caseId, eventId);
    return this.submitEvent(page, caseId, eventId, token, data, ignoreWarning);
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= this.maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i === this.maxRetries) break;
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}