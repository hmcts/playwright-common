import { APIRequestContext, request } from "@playwright/test";

// Required parameters for generating a token
export interface IdamTokenBaseParams {
    grantType: string;
    clientId: string;
    clientSecret: string;
    scope: string;
}

// Optional parameters (extends required ones)
export interface IdamTokenParams extends IdamTokenBaseParams {
    username?: string;
    password?: string;
    redirectUri?: string;
}

// Parameters for creating a user
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
        this.idamWebUrl = process.env.IDAM_WEB_URL || "";
        this.idamTestingSupportUrl = process.env.IDAM_TESTING_SUPPORT_URL || "";

        if (!this.idamWebUrl || !this.idamTestingSupportUrl) {
            throw new Error(
                "Missing required environment variables: IDAM_WEB_URL and/or IDAM_SUPPORT_URL"
            );
        }
    }

    /**
     * Generates an IDAM bearer token.
     * Should be called once at the beginning of a test run (for example in global.setup.ts).
     * The token is valid for up to 8 hours.
     */
    public async generateIdamToken(params: IdamTokenParams): Promise<string> {
        const {
            grantType,
            clientId,
            clientSecret,
            scope,
            username,
            password,
            redirectUri,
        } = params;

        const url = `${this.idamWebUrl}/o/token`;
        const data: Record<string, string> = {
            grant_type: grantType,
            client_id: clientId,
            client_secret: clientSecret,
            scope,
        };

        if (username) data.username = username;
        if (password) data.password = password;
        if (redirectUri) data.redirect_uri = redirectUri;

        const apiContext: APIRequestContext = await request.newContext();

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

            const responseData = await response.json();
            return responseData.access_token;
        } catch (error) {
            throw new Error(
                `Error while fetching token: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Creates a test user in IDAM with specified roles.
     */
    public async createUser({
        bearerToken,
        email,
        password,
        forename,
        surname,
        roleNames
    }: CreateUserParams) {
        const url = `${this.idamTestingSupportUrl}/test/idam/users`;
        const apiContext: APIRequestContext = await request.newContext();
    
        const response = await apiContext.post(url, {
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
            },
            data: {
                password,
                user: {
                    email,
                    forename,
                    surname,
                    roleNames,
                },
            },
        });

        if (response.status() === 201) {
            return { email, password, forename, surname };
        }

        throw new Error(
            `Failed to create user: ${await response.text()} (Status Code: ${response.status()})`
        );
    }
}    
