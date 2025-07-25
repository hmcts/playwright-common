import { APIRequestContext, request } from "@playwright/test";

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
    id: string;
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
          `Failed to fetch access token: ${response.status()} - ${errorText}.`
        );
      }

      const json = await response.json();
      return json.access_token;
    } catch (error) {
      throw new Error(
        `Error while fetching token: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

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
          id: payload.user.id,
          email: payload.user.email,
          forename: payload.user.forename,
          surname: payload.user.surname,
          roleNames: payload.user.roleNames,
        },
      },
    });
    const json = await response.json();
    if (response.status() === 201) {
      return {
        id: json.id,
        email: payload.user.email,
        password: payload.password,
        forename: payload.user.forename,
        surname: payload.user.surname,
        roleNames: payload.user.roleNames,
      };
    }

    throw new Error(
      `Failed to create user: ${await response.text()} (Status Code: ${response.status()})`
    );
  }

  public async getUserInfo(
    payload: GetUserInfoParams
  ): Promise<UserInfoParams> {
    let url: string;
    if ((payload.email && payload.id) || (!payload.email && !payload.id)) {
      throw new Error(
        "You must provide either an email or an id, but not both."
      );
    }
    if (payload.email) {
      url = `${
        this.idamTestingSupportUrl
      }/test/idam/users?email=${encodeURIComponent(payload.email)}`;
    } else {
      url = `${this.idamTestingSupportUrl}/test/idam/users/${payload.id}`;
    }

    const apiContext = await this.createApiContext();
    const response = await apiContext.get(url, {
      headers: {
        Authorization: `Bearer ${payload.bearerToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok()) {
      throw new Error(
        `Failed to fetch user info: ${await response.text()} (Status Code: ${response.status()})`
      );
    }

    const json = await response.json();
    return {
      id: json.id,
      email: json.email,
      forename: json.forename,
      surname: json.surname,
      displayName: json.displayName,
      roleNames: json.roleNames,
    };
  }

  public async updateUser(payload: UpdateUserParams): Promise<UpdatedUser> {
    const apiContext = await this.createApiContext();
    const url = `${this.idamTestingSupportUrl}/test/idam/users/${payload.id}`;
    const response = await apiContext.put(url, {
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
    });
    const json = await response.json();
    if (response.status() === 200) {
      return {
        id: json.id,
        email: json.email,
        password: json.password,
        forename: json.forename,
        surname: json.surname,
        displayName: json.displayName,
        roleNames: json.roleNames,
        accountStatus: json.accountStatus,
        recordType: json.recordType,
      };
    }

    throw new Error(
      `Failed to update user: ${await response.text()} (Status Code: ${response.status()})`
    );
  }
}
