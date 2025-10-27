import type { Logger } from "winston";
import {
  ApiClient,
  ApiClientError,
  type ApiClientOptions,
} from "./api-client.js";
import { createChildLogger, createLogger } from "../logging/logger.js";

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
  private readonly logger: Logger;
  private readonly client: ApiClient;

  constructor(options?: ServiceAuthUtilsOptions) {
    this.serviceAuthUrl = process.env.S2S_URL ?? "";

    if (!this.serviceAuthUrl) {
      throw new Error("Missing required environment variables: S2S_URL");
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
        },
        responseType: "text",
      });

      if (!response.data) {
        throw new Error("Service-to-service token response was empty.");
      }

      return response.data;
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
      const body = error.logEntry.response.body;
      const serialisedBody =
        typeof body === "string"
          ? body
          : body
          ? JSON.stringify(body)
          : "No response body";

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
}
