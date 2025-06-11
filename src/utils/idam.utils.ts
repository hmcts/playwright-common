import { APIRequestContext, request } from "@playwright/test";

/**
 * Utility class to interact with HMCTS IDAM APIs.
 * Provides methods to generate bearer tokens and create test users.
 */
export class IdamUtils {

    /**
     * Generates an IDAM bearer token.
     * Should be called once at the beginning of a test run (for example in global.setup.ts).
     * The token is valid for up to 8 hours.
     *
     * @param grantType - OAuth2 grant type (e.g., "password", "client_credentials").
     * @param clientId - The client ID of the requesting application.
     * @param clientSecret - The client secret associated with the client ID.
     * @param scope - Requested scopes for the token.
     * @param username - Optional user email/username (required for some grant types).
     * @param password - Optional user password (required for some grant types).
     * @param redirectUri - Optional redirect URI (used in authorization_code flows).
     * @returns A Promise that resolves to the access token string.
     * @throws If the request fails or receives a non-OK response.
     */
    public async generateIdamToken(
        grantType: string,
        clientId: string,
        clientSecret: string,
        scope: string,
        username?: string,
        password?: string,
        redirectUri?: string
    ) {
        const url = "https://idam-web-public.aat.platform.hmcts.net/o/token";
        const data: Record<string, string> = {
            grant_type: grantType,
            client_id: clientId,
            client_secret: clientSecret,
            scope,
          };
          // as these are optional parameters, append them to data if present
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
                    `Failed to fetch access token: ${response.status()} - ${errorText}. Ensure your VPN is connected or check your URL/SECRET.`
                );
            }

            const responseData = await response.json();
            return responseData.access_token;
        } catch (error) {
            throw new Error(
                `An error occurred while fetching the access token: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Creates a test user in IDAM with specified roles.
     *
     * @param idamBearerToken - A valid IDAM admin or support bearer token.
     * @param email - The email address for the new user.
     * @param password - The password for the new user.
     * @param forename - The forename (first name) of the user.
     * @param surname - The surname (last name) of the user.
     * @param roleNames - Array of role names to assign to the user (e.g., ["citizen"]).
     * @returns A Promise resolving to an object containing the user’s credentials.
     * @throws If the user creation fails or returns a non-201 status code.
     */
    public async createUser(
        idamBearerToken: string,
        email: string,
        password: string,
        forename: string,
        surname: string,
        roleNames: string[]
    ) {
        const url = "https://idam-testing-support-api.aat.platform.hmcts.net/test/idam/users";
        const apiContext: APIRequestContext = await request.newContext();

        const response = await apiContext.post(url, {
            headers: {
                Authorization: `Bearer ${idamBearerToken}`,
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
