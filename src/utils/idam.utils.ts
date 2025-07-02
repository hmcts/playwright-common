import { APIRequestContext, request } from "@playwright/test";

export interface IdamTokenParams {
  grantType: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  username?: string;
  password?: string;
  redirectUri?: string;
}

export interface CreateUserParams {
  bearerToken: string;
  password: string;
  user: {
    email: string;
    forename: string;
    surname: string;
    roleNames: string[];
  };
}

export interface CreatedUser {
  email: string;
  password: string;
  forename: string;
  surname: string;
}

export interface ServiceTokenParams {
  microservice: string;
}

/**
 * Utility class to interact with HMCTS IDAM APIs.
 * Provides methods to generate bearer tokens and create test users.
 */
export class IdamUtils {
  private readonly idamWebUrl: string;
  private readonly idamTestingSupportUrl: string;
  private readonly idamServiceAuthUrl: string
  constructor() {
    this.idamWebUrl = process.env.IDAM_WEB_URL ?? "";
    this.idamTestingSupportUrl = process.env.IDAM_TESTING_SUPPORT_URL ?? "";
    this.idamServiceAuthUrl = process.env.IDAM_S2S_URL ?? "";
    if (!this.idamWebUrl || !this.idamTestingSupportUrl || !this.idamServiceAuthUrl) {
      throw new Error(
        "Missing required environment variables: IDAM_WEB_URL, IDAM_TESTING_SUPPORT_URL and/or IDAM_S2S_URL",
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
   * @param payload {@link IdamTokenParams} - The form data required to generate the token.
   */
  public async generateIdamToken(payload: IdamTokenParams): Promise<string> {
    const url = `${this.idamWebUrl}/o/token`;

    const data: Record<string, string> = {
      grant_type: payload.grantType,
      client_id: payload.clientId,
      client_secret: payload.clientSecret,
      scope: payload.scope,
      username: payload.username ?? "",
      password: payload.password ?? "",
      redirectUri: payload.redirectUri ?? "",
    };

    const apiContext = await this.createApiContext();

    try {
      const response = await apiContext.post(url, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        form: data,
      });

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch access token: ${response.status()} - ${errorText}.`,
        );
      }

      const json = await response.json();
      return json.access_token;
    } catch (error) {
      throw new Error(
        `Error while fetching token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Creates a test user in IDAM with specified roles.
   *
   * @param payload {@link CreateUserParams} - The payload required to create the user.
   */
  public async createUser(payload: CreateUserParams): Promise<CreatedUser> {
    const url = `${this.idamTestingSupportUrl}/test/idam/users`;
    const apiContext = await this.createApiContext();

    const response = await apiContext.post(url, {
      headers: {
        Authorization: `Bearer ${payload.bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        password: payload.password,
        user: {
          email: payload.user.email,
          forename: payload.user.forename,
          surname: payload.user.surname,
          roleNames: payload.user.roleNames,
        },
      },
    });

    if (response.status() === 201) {
      return {
        email: payload.user.email,
        password: payload.password,
        forename: payload.user.forename,
        surname: payload.user.surname,
      };
    }

    throw new Error(
      `Failed to create user: ${await response.text()} (Status Code: ${response.status()})`,
    );
  }
  /**
   * Retrieves a Service Auth token.
   *
   * @param payload {@link ServiceTokenParams} - The form data required to retrieve the token.
   */
  public async retrieveServiceAuthToken(payload: ServiceTokenParams): Promise<string> {
    const apiContext = await this.createApiContext();

    try {
      const response = await apiContext.post(this.idamServiceAuthUrl, {
        headers: {
          "content-type": "application/json",
          Accept: "*/*",
        },
        data: {
          microservice: payload.microservice,
        },
      });

      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch S2S token: ${response.status()} - ${errorText}. Ensure your VPN is connected or check your URL/SECRET.`
        );
      }

      return response.text();
    } catch (error) {
      throw new Error(
        `An error occurred while fetching the access token: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}
