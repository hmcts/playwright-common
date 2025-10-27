import type { Logger } from "winston";
import {
  ApiClient,
  ApiClientError,
  type ApiClientOptions,
  type ApiRequestOptions,
} from "./api-client.js";
import { createChildLogger, createLogger } from "../logging/logger.js";

interface UserBase {
  email: string;
  forename: string;
  surname: string;
  roleNames: string[];
}

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
    id?: string;
  };
}

export interface CreatedUser extends UserBase {
  id: string;
  password: string;
}

export type GetUserInfoParams =
  | { email: string; id?: never; bearerToken: string }
  | { id: string; email?: never; bearerToken: string };

export interface UserInfoParams extends UserBase {
  id: string;
  displayName: string;
}

export interface UpdateUserParams {
  id: string;
  bearerToken: string;
  password: string;
  user: {
    email: string;
    forename: string;
    surname: string;
    roleNames: string[];
  };
}

export interface UpdatedUser extends UserBase {
  id: string;
  displayName: string;
  password?: string;
  accountStatus: string;
  recordType: string;
}

export interface IdamUtilsOptions {
  logger?: Logger;
  tokenClient?: ApiClient;
  testingSupportClient?: ApiClient;
  correlationId?: string;
  apiClientOptions?: Pick<
    ApiClientOptions,
    "redaction" | "captureRawBodies" | "onResponse"
  >;
}

interface TokenResponse {
  access_token: string;
}

interface CreatedUserResponse {
  id: string;
  email: string;
  forename: string;
  surname: string;
  roleNames: string[];
}

interface UpdatedUserResponse extends CreatedUserResponse {
  displayName: string;
  password?: string;
  accountStatus: string;
  recordType: string;
}

/**
 * Utility class to interact with HMCTS IDAM APIs.
 * Provides methods to generate bearer tokens and create test users.
 */
export class IdamUtils {
  private readonly idamWebUrl: string;
  private readonly idamTestingSupportUrl: string;
  private readonly logger: Logger;
  private readonly tokenClient: ApiClient;
  private readonly testingSupportClient: ApiClient;

  constructor(options?: IdamUtilsOptions) {
    this.idamWebUrl = process.env.IDAM_WEB_URL ?? "";
    this.idamTestingSupportUrl = process.env.IDAM_TESTING_SUPPORT_URL ?? "";

    if (!this.idamWebUrl || !this.idamTestingSupportUrl) {
      throw new Error(
        "Missing required environment variables: IDAM_WEB_URL and/or IDAM_TESTING_SUPPORT_URL"
      );
    }

    this.logger =
      options?.logger ??
      createLogger({
        serviceName: "IdamUtils",
      });

    const buildClient = (
      baseUrl: string,
      name: string,
      providedClient?: ApiClient
    ): ApiClient =>
      providedClient ??
      new ApiClient({
        baseUrl,
        name,
        logger: createChildLogger(this.logger, { client: name }),
        correlationId: options?.correlationId,
        redaction: options?.apiClientOptions?.redaction,
        captureRawBodies: options?.apiClientOptions?.captureRawBodies,
        onResponse: options?.apiClientOptions?.onResponse,
      });

    this.tokenClient = buildClient(
      this.idamWebUrl,
      "idam-web",
      options?.tokenClient
    );
    this.testingSupportClient = buildClient(
      this.idamTestingSupportUrl,
      "idam-testing-support",
      options?.testingSupportClient
    );
  }

  /**
   * Generates an IDAM bearer token.
   * Should be called once at the beginning of a test run (for example in global.setup.ts).
   * Token valid for up to 8 hours.
   *
   * @param payload {@link IdamTokenParams} - The form data required to generate the token.
   */
  public async generateIdamToken(payload: IdamTokenParams): Promise<string> {
    try {
      const response = await this.tokenClient.post<TokenResponse>("o/token", {
        form: buildTokenForm(payload),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        responseType: "json",
      });

      if (!response.data?.access_token) {
        throw new Error("Missing access token in response payload.");
      }

      return response.data.access_token;
    } catch (error) {
      throw this.handleApiError(
        error,
        "Failed to fetch access token",
        "generateIdamToken"
      );
    }
  }

  /**
   * Creates a test user in IDAM with specified roles.
   *
   * @param payload {@link CreateUserParams} - The payload required to create the user.
   */
  public async createUser(payload: CreateUserParams): Promise<CreatedUser> {
    try {
      const response = await this.testingSupportClient.post<CreatedUserResponse>(
        "/test/idam/users",
        {
          headers: {
            Authorization: `Bearer ${payload.bearerToken}`,
            "Content-Type": "application/json",
          },
          data: {
            password: payload.password,
            user: {
              id: payload.user.id,
              email: payload.user.email,
              forename: payload.user.forename,
              surname: payload.user.surname,
              roleNames: payload.user.roleNames,
            },
          },
        }
      );

      if (response.status !== 201) {
        throw new Error(
          `Unexpected status code ${response.status} returned when creating user.`
        );
      }

      if (!response.data?.id) {
        throw new Error("Create user response was missing an id.");
      }

      return {
        id: response.data.id,
        email: payload.user.email,
        password: payload.password,
        forename: payload.user.forename,
        surname: payload.user.surname,
        roleNames: payload.user.roleNames,
      };
    } catch (error) {
      throw this.handleApiError(
        error,
        "Failed to create user",
        "createUser"
      );
    }
  }

  /**
   * Gets user info based on user email OR id provided.
   *
   * @param payload {@link GetUserInfoParams} - The payload required to get user information.
   */
  public async getUserInfo(
    payload: GetUserInfoParams
  ): Promise<UserInfoParams> {
    let url: string;
    if ((payload.email && payload.id) || (!payload.email && !payload.id)) {
      throw new Error(
        "You must provide either an email or an id, but not both."
      );
    }
    const requestOptions: ApiRequestOptions = {
      headers: {
        Authorization: `Bearer ${payload.bearerToken}`,
        "Content-Type": "application/json",
      },
    };
    try {
      if (payload.email) {
        url = "/test/idam/users";
        const response = await this.testingSupportClient.get<
          UserInfoParams | UserInfoParams[]
        >(url, {
          ...requestOptions,
          query: {
            email: payload.email,
          },
        });

        const userData = Array.isArray(response.data)
          ? response.data[0]
          : response.data;

        if (!userData) {
          throw new Error("User not found.");
        }

        return userData;
      }

      url = `/test/idam/users/${payload.id}`;
      const response = await this.testingSupportClient.get<UserInfoParams>(
        url,
        requestOptions
      );

      return response.data;
    } catch (error) {
      throw this.handleApiError(
        error,
        "Failed to fetch user info",
        "getUserInfo"
      );
    }
  }

  /**
   * Updates a user based on the id
   *
   * @param payload {@link UpdateUserParams} - The payload required to get user information.
   */
  public async updateUser(payload: UpdateUserParams): Promise<UpdatedUser> {
    try {
      const response = await this.testingSupportClient.put<UpdatedUserResponse>(
        `/test/idam/users/${payload.id}`,
        {
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
              displayName: `${payload.user.forename} ${payload.user.surname}`,
              roleNames: payload.user.roleNames,
              accountStatus: "ACTIVE",
              recordType: "LIVE",
            },
          },
        }
      );

      return {
        id: response.data?.id ?? payload.id,
        email: response.data?.email ?? payload.user.email,
        password: response.data?.password,
        forename: response.data?.forename ?? payload.user.forename,
        surname: response.data?.surname ?? payload.user.surname,
        displayName:
          response.data?.displayName ??
          `${payload.user.forename} ${payload.user.surname}`,
        roleNames: response.data?.roleNames ?? payload.user.roleNames,
        accountStatus: response.data?.accountStatus ?? "ACTIVE",
        recordType: response.data?.recordType ?? "LIVE",
      };
    } catch (error) {
      throw this.handleApiError(
        error,
        "Failed to update user",
        "updateUser"
      );
    }
  }

  public async dispose(): Promise<void> {
    await Promise.all([
      this.tokenClient.dispose(),
      this.testingSupportClient.dispose(),
    ]);
  }

  private handleApiError(
    error: unknown,
    message: string,
    operation: string
  ): Error {
    if (error instanceof ApiClientError) {
      const body = error.logEntry.response.body;
      const serialisedBody =
        typeof body === "string"
          ? body
          : body
          ? JSON.stringify(body)
          : "No response body";

      return new Error(
        `${message}: ${serialisedBody} (Status Code: ${error.status})`
      );
    }

    this.logger.error(message, { operation, error });
    if (error instanceof Error) {
      return new Error(`${message}: ${error.message}`);
    }

    return new Error(`${message}: ${String(error)}`);
  }
}

function buildTokenForm({
  grantType,
  clientId,
  clientSecret,
  scope,
  username,
  password,
  redirectUri,
}: IdamTokenParams): Record<string, string> {
  return {
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    username: username ?? "",
    password: password ?? "",
    redirectUri: redirectUri ?? "",
  };
}
