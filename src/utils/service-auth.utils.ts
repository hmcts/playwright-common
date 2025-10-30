import type { Logger } from "winston";
import {
  ApiClient,
  ApiClientError,
  type ApiClientOptions,
} from "./api-client.js";
import { createChildLogger, createLogger } from "../logging/logger.js";
import { serialiseApiBody } from "./error.utils.js";

export interface ServiceTokenParams {
  microservice: string;
}

export interface ServiceAuthUtilsOptions {
  logger?: Logger;
  client?: ApiClient;
  correlationId?: string;
  apiClientOptions?: Pick<
    ApiClientOptions,
    "redaction" | "captureRawBodies" | "onResponse"
  >;
}

export class ServiceAuthUtils {
  private readonly serviceAuthUrl: string;
  private readonly serviceAuthSecret: string;
  private readonly logger: Logger;
  private readonly client: ApiClient;

  constructor(options?: ServiceAuthUtilsOptions) {
    this.serviceAuthUrl = process.env.S2S_URL ?? "";
    this.serviceAuthSecret = process.env.S2S_SECRET ?? "";

    if (!this.serviceAuthUrl || !this.serviceAuthSecret) {
      throw new Error(
        "Missing required environment variables: S2S_URL and/or S2S_SECRET"
      );
    }
    this.logger =
      options?.logger ??
      createLogger({
        serviceName: "ServiceAuthUtils",
      });

    this.client =
      options?.client ??
      new ApiClient({
        baseUrl: this.serviceAuthUrl,
        name: "service-auth",
        logger: createChildLogger(this.logger, { client: "service-auth" }),
        correlationId: options?.correlationId,
        redaction: options?.apiClientOptions?.redaction,
        captureRawBodies: options?.apiClientOptions?.captureRawBodies,
        onResponse: options?.apiClientOptions?.onResponse,
      });
  }
  /**
   * Retrieves a Service Auth token.
   *
   * @param payload {@link ServiceTokenParams} - The form data required to retrieve the token.
   */
  public async retrieveToken(payload: ServiceTokenParams): Promise<string> {
    try {
      const response = await this.client.post<string>("", {
        data: {
          microservice: payload.microservice,
        },
        headers: {
          "content-type": "application/json",
          accept: "*/*",
          Authorization: ServiceAuthUtils.buildBasicAuthHeader(
            payload.microservice,
            this.serviceAuthSecret
          ),
        },
        responseType: "text",
      });

      if (!response.data) {
        throw new Error("Service-to-service token response was empty.");
      }

      const token = response.data.trim();
      if (!token) {
        throw new Error("Service-to-service token response was blank.");
      }

      return token;
    } catch (error) {
      throw this.handleApiError(
        error,
        "Failed to fetch S2S token",
        payload.microservice
      );
    }
  }

  public async dispose(): Promise<void> {
    await this.client.dispose();
  }

  private handleApiError(
    error: unknown,
    message: string,
    microservice: string
  ): Error {
    if (error instanceof ApiClientError) {
      const serialisedBody = serialiseApiBody(error.logEntry.response.body);

      return new Error(
        `${message}: ${serialisedBody} (Status Code: ${error.status}). Ensure your VPN is connected or check your URL/SECRET.`
      );
    }

    this.logger.error(message, { microservice, error });
    if (error instanceof Error) {
      return new Error(`${message}: ${error.message}`);
    }
    return new Error(`${message}: ${String(error)}`);
  }

  private static buildBasicAuthHeader(
    microservice: string,
    secret: string
  ): string {
    const raw = `${microservice}:${secret}`;
    const encoded = Buffer.from(raw).toString("base64");
    return `Basic ${encoded}`;
  }
}
