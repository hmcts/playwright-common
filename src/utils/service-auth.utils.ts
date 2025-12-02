import type { Logger } from "winston";
import {
  ApiClient,
  ApiClientError,
  type ApiClientOptions,
} from "./api-client.js";
import { createChildLogger, createLogger } from "../logging/logger.js";
import { serialiseApiBody } from "./error.utils.js";
import { withRetry, isRetryableError } from "./retry.utils.js";

export interface ServiceTokenParams {
  microservice: string;
  secret?: string;
}

export interface ServiceAuthUtilsOptions {
  logger?: Logger;
  client?: ApiClient;
  correlationId?: string;
  secret?: string;
  apiClientOptions?: Pick<
    ApiClientOptions,
    "redaction" | "captureRawBodies" | "onResponse"
  >;
}

export class ServiceAuthUtils {
  private readonly serviceAuthUrl: string;
  private readonly serviceAuthSecret: string | undefined;
  private readonly logger: Logger;
  private readonly client: ApiClient;

  constructor(options?: ServiceAuthUtilsOptions) {
    this.serviceAuthUrl = process.env["S2S_URL"] ?? "";
    this.serviceAuthSecret =
      options?.secret ?? process.env.S2S_SECRET ?? undefined;

    if (!this.serviceAuthUrl) {
      throw new Error("Missing required environment variable: S2S_URL");
    }
    this.logger =
      options?.logger ??
      createLogger({
        serviceName: "ServiceAuthUtils",
      });

    this.client =
      options?.client ??
      (() => {
        const clientOptions: ApiClientOptions = {
          baseUrl: this.serviceAuthUrl,
          name: "service-auth",
          logger: createChildLogger(this.logger, { client: "service-auth" }),
        };
        if (options?.correlationId) clientOptions.correlationId = options.correlationId;
        const apiOpts = options?.apiClientOptions;
        if (apiOpts?.redaction) clientOptions.redaction = apiOpts.redaction;
        if (apiOpts?.captureRawBodies !== undefined) clientOptions.captureRawBodies = apiOpts.captureRawBodies;
        if (apiOpts?.onResponse) clientOptions.onResponse = apiOpts.onResponse;
        return new ApiClient(clientOptions);
      })();
  }
  /**
   * Retrieves a Service Auth token.
   *
   * @param payload {@link ServiceTokenParams} - The form data required to retrieve the token.
   */
  public async retrieveToken(payload: ServiceTokenParams): Promise<string> {
    try {
      const secret = payload.secret ?? this.serviceAuthSecret;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "*/*",
      };

      if (secret) {
        headers["Authorization"] = ServiceAuthUtils.buildBasicAuthHeader(
          payload.microservice,
          secret
        );
      } else {
        this.logger.info(
          "No S2S secret provided; sending request without Authorization header.",
          {
            microservice: payload.microservice,
          }
        );
      }

      // Optional retry/backoff controlled via env vars
      const attempts = Number(process.env.S2S_RETRY_ATTEMPTS ?? 1);
      const baseMs = Number(process.env.S2S_RETRY_BASE_MS ?? 200);
      const exec = async () =>
        this.client.post<string>("", {
          data: {
            microservice: payload.microservice,
          },
          headers,
          responseType: "text",
        });

      const response = attempts > 1
        ? await withRetry(exec, attempts, baseMs, 2000, 15000, isRetryableError)
        : await exec();

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
