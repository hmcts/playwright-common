export interface CcdApiClientOptions {
  baseUrl: string; // e.g. https://gateway-ccd.aat.platform.hmcts.net
  /**
   * Provide tokens per call (recommended), or set defaults here.
   */
  authToken?: string; 
  serviceToken?: string;
}

export interface CcdStartEventTokenResponse {
  token: string;
}

export interface CcdCaseResponse {
  id: string;
  state?: string;
  case_type?: string;
  jurisdiction?: string;
  data?: Record<string, unknown>;
}

export class CcdApiClient {
  private readonly baseUrl: string;
  private readonly defaultAuthToken: string | undefined;
  private readonly defaultServiceToken: string | undefined;

  constructor(options: CcdApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.defaultAuthToken = options.authToken;
    this.defaultServiceToken = options.serviceToken;
  }

  /**
   * GET token for start event (Data Store API pattern).
   * Example path used by many services:
   * /caseworkers/{userId}/jurisdictions/{jid}/case-types/{ctid}/cases/{caseId}/event-triggers/{eventId}/token
   */
  async getStartEventToken(path: string, opts?: { authToken?: string; serviceToken?: string }): Promise<string> {
    const res = await fetch(this.baseUrl + path, {
      method: "GET",
      headers: this.authHeaders(opts),
    });

    if (!res.ok) {
      throw new Error(`getStartEventToken failed: HTTP ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as CcdStartEventTokenResponse;
    if (!json?.token) throw new Error(`Missing token in start-event response: ${JSON.stringify(json)}`);
    return json.token;
  }

  /**
   * POST to create a case.
   * Path example:
   * /caseworkers/{userId}/jurisdictions/{jid}/case-types/{ctid}/cases
   */
  async createCase(path: string, payload: unknown, opts?: { authToken?: string; serviceToken?: string }): Promise<CcdCaseResponse> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: { ...this.authHeaders(opts), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`createCase failed: HTTP ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as CcdCaseResponse;
  }

  /**
   * POST to submit an event (update case).
   * Path example:
   * /caseworkers/{userId}/jurisdictions/{jid}/case-types/{ctid}/cases/{caseId}/events
   */
  async submitEvent(path: string, payload: unknown, opts?: { authToken?: string; serviceToken?: string }): Promise<CcdCaseResponse> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: { ...this.authHeaders(opts), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`submitEvent failed: HTTP ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as CcdCaseResponse;
  }

  private authHeaders(opts?: { authToken?: string; serviceToken?: string }): Record<string, string> {
    const authToken = opts?.authToken ?? this.defaultAuthToken;
    const serviceToken = opts?.serviceToken ?? this.defaultServiceToken;

    if (!authToken || !serviceToken) {
      throw new Error("Missing authToken/serviceToken. Provide them in constructor or per call.");
    }

    return {
      Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`,
      ServiceAuthorization: serviceToken.startsWith("Bearer ") ? serviceToken : `Bearer ${serviceToken}`,
      Accept: "application/json",
    };
  }
}