import { test as base } from "@playwright/test";
import {
  ApiClient,
  buildApiAttachment,
  isRetryableError,
  withRetry,
  createLogger,
  type ApiLogEntry,
} from "@hmcts/playwright-common";

type Fixtures = {
  logger: ReturnType<typeof createLogger>;
  capturedCalls: ApiLogEntry[];
  backendClient: ApiClient;
};

export const test = base.extend<Fixtures>({
  logger: async ({}, use, workerInfo) => {
    const logger = createLogger({
      serviceName: "backend-tests",
      defaultMeta: { workerId: workerInfo.workerIndex },
    });
    await use(logger);
  },
  capturedCalls: async ({}, use) => {
    const calls: ApiLogEntry[] = [];
    await use(calls);
  },
  backendClient: async ({ logger, capturedCalls }, use, testInfo) => {
    const client = new ApiClient({
      baseUrl: process.env.BACKEND_BASE_URL,
      name: "backend",
      logger,
      onResponse: (entry) => capturedCalls.push(entry),
      circuitBreaker: {
        enabled: true,
        options: { failureThreshold: 5, cooldownMs: 30000, halfOpenMaxAttempts: 2 },
      },
      onError: (err) => {
        // Example telemetry sink
        logger.error("api-error", { status: err.status, url: err.logEntry.url });
      },
    });

    await use(client);
    await client.dispose();

    if (capturedCalls.length) {
      // Attach all calls in a single artefact
      await testInfo.attach("api-calls.json", {
        body: JSON.stringify(capturedCalls, null, 2),
        contentType: "application/json",
      });
    }
  },
});

// Example test using advanced retry
test("health endpoint is OK", async ({ backendClient }, testInfo) => {
  const response = await withRetry(
    () => backendClient.get<{ status: string }>("/health"),
    Number(process.env.RETRY_ATTEMPTS ?? 3),
    Number(process.env.RETRY_BASE_MS ?? 200),
    2000,
    15000,
    isRetryableError
  );

  // Attach the sanitised call (CI-safe by default)
  const attachment = buildApiAttachment(response.logEntry, {
    includeRaw: process.env.PLAYWRIGHT_DEBUG_API === "1",
  });
  await testInfo.attach(attachment.name, {
    body: attachment.body,
    contentType: attachment.contentType,
  });

  // Assert
  await expect.soft(response.status).toBe(200);
  await expect.soft(response.data?.status).toBe("UP");
});
