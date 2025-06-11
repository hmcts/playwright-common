import { APIRequestContext, request } from "@playwright/test";

export interface IdamTokenBaseParams {
  grantType: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

export interface IdamTokenParams extends IdamTokenBaseParams {
  username?: string;
  password?: string;
  redirectUri?: string;
}

export interface CreateUserParams {
  bearerToken: string;
  email: string;
  password: string;
  forename: string;
  surname: string;
  roleNames: string[];
}

/**
 * Utility class to interact with HMCTS IDAM APIs.
 * Provides methods to generate bearer tokens and create test users.
 */
export class IdamUtils {
  private readonly idamWebUrl: string;
  private readonly idamTestingSupportUrl: string;

  constructor() {
    this.idamWebUrl = process.env.IDAM_WEB_URL ?? "";
    this.idamTestingSupportUrl = process.env.IDAM_TESTING_SUPPORT_URL ?? "";

    if (!this.idamWebUrl || !this.idamTestingSupportUrl) {
      throw new Error(
        "Missing required environment variables: IDAM_WEB_URL and/or IDAM_TESTING_SUPPORT_URL"
      );
    }
  }

  private async createApiContext(): Promise<APIRequestContext> {
    return await request.newContext();
  }

  /**
   * Generates an IDAM bearer token.
   * Should be called once at the beginning of a test run (for example in global.setup.ts).
   * Token valid for up to 8 hours.
   *
   * @param options - The parameters required to generate the token.
   */
  public async generateIdamToken(options: IdamTokenParams): Promise<string> {
    const url = `${this.idamWebUrl}/o/token`;

    const data: Record<string, string> = {
      grant_type: options.grantType,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      scope: options.scope,
    };

    if (options.username) data.username = options.username;
    if (options.password) data.password = options.password;
    if (options.redirectUri) data.redirect_uri = options.redirectUri;

    const apiContext = await this.createApiContext();

    try {
      const response = await apiContext.post(url, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        form: data,
      });

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch access token: ${response.status()} - ${errorText}.`);
      }

      const json = await response.json();
      return json.access_token;
    } catch (error) {
      throw new Error(
        `Error while fetching token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a test user in IDAM with specified roles.
   *
   * @param options - The parameters required to create the user.
   */
  public async createUser(options: CreateUserParams) {
    const url = `${this.idamTestingSupportUrl}/test/idam/users`;
    const apiContext = await this.createApiContext();

    const response = await apiContext.post(url, {
      headers: {
        Authorization: `Bearer ${options.bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        password: options.password,
        user: {
          email: options.email,
          forename: options.forename,
          surname: options.surname,
          roleNames: options.roleNames,
        },
      },
    });

    if (response.status() === 201) {
      return {
        email: options.email,
        password: options.password,
        forename: options.forename,
        surname: options.surname,
      };
    }

    throw new Error(
      `Failed to create user: ${await response.text()} (Status Code: ${response.status()})`
    );
  }
}
