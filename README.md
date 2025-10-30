# playwright-common

This repository is a shared playwright package for use within HMCTS. The below list is available from this package:

- **Shared Page Objects & Components**: Page objects and components commonly used across multiple HMCTS teams or services. This excludes those created and used exclusively within a single team or service.
- **Configuration**: Configuration for playwright: common config, project config & linting
- **Utilities**: Commonly used logic for interacting with HMCTS pages, API's or playwright.
- **Observability Foundations**: A shared Winston logger, redaction helpers, and an instrumented API client that produce ready-to-attach Playwright artefacts.

## Contributing

We all share the responsibility of ensuring this repo is up to date and accurate in terms of best practice. If you would like to contribute you can raise a github issue with the improvement you are suggesting or raise a PR yourself. See the [contribution guide](https://github.com/hmcts/tcoe-playwright-example/blob/master/CONTRIBUTING.md) for more info.

TCoE Best Practices for setting up playwright in your service can be found in the [playwright-e2e/readme.md](https://github.com/hmcts/tcoe-playwright-example/blob/master/docs/BEST_PRACTICE.md).

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- Node.js (v20.11.1 or later)
- Yarn (Berry)

### Installation

Clone the repository and install the dependencies:

```bash
git clone git@github.com:hmcts/playwright-common.git
cd playwright-common
yarn install
yarn build
```

### Mandatory Requirements
This library is configuration-driven meaning it relies on environment variables or other configuration that must be defined in the consuming test project as this config could be specific to a service or you may be using different environments. You'll need to set up any necessary config such as env vars in your own test project. 

#### Logging & Redaction Toggles
The shared logger and API client read the following (optional) environment variables:

- `LOG_LEVEL` – defaults to `info`.
- `LOG_FORMAT` – `json` (default) or `pretty`.
- `LOG_REDACTION` – set to `off` to disable masking (default is `on`).
- `PLAYWRIGHT_DEBUG_API` – set to `1` or `true` to capture raw API payloads for Playwright attachments.

#### IdamUtils Requirements
To use the `IdamUtils` class, you must configure the following environment variables in your repository:

- `IDAM_WEB_URL`  
- `IDAM_TESTING_SUPPORT_URL`


These values will vary depending on the environment you are testing against:

**For AAT environment:**
```env
IDAM_WEB_URL=https://idam-web-public.aat.platform.hmcts.net  
IDAM_TESTING_SUPPORT_URL=https://idam-testing-support-api.aat.platform.hmcts.net
```
**For DEMO environment:**
```env
IDAM_WEB_URL=https://idam-web-public.demo.platform.hmcts.net  
IDAM_TESTING_SUPPORT_URL=https://idam-testing-support-api.demo.platform.hmcts.net
```
#### ServiceAuthUtils Requirements
To use the `ServiceAuthUtils` class, you must configure the following environment variables in your repository:

- `S2S_URL`
- `S2S_SECRET` (the client secret used when generating a lease token)

**For AAT environment:**
```env
S2S_URL = http://rpe-service-auth-provider-aat.service.core-compute-aat.internal/testing-support/lease 
S2S_SECRET = <fetch from Azure Key Vault>
```
**For DEMO environment:**
```env
S2S_URL = http://rpe-service-auth-provider-demo.service.core-compute-demo.internal/testing-support/lease
S2S_SECRET = <fetch from Azure Key Vault>
```

### Logging & API Client

```ts
import {
  ApiClient,
  buildApiAttachment,
  createLogger,
} from "@hmcts/playwright-common";

const logger = createLogger({
  serviceName: "my-service-tests",
});

const apiClient = new ApiClient({
  baseUrl: process.env.BACKEND_BASE_URL,
  name: "service-backend",
  logger,
  onResponse: (entry) => {
    // Example: push entries into an array for later Playwright attachments
    capturedEntries.push(entry);
  },
});

const response = await apiClient.post<{ token: string }>("/token", {
  data: { username: "user", password: "pass" },
});

// Attach the sanitised call to a Playwright test
const attachment = buildApiAttachment(response.logEntry, {
  includeRaw: process.env.PLAYWRIGHT_DEBUG_API === "1",
});
await testInfo.attach(attachment.name, {
  body: attachment.body,
  contentType: attachment.contentType,
});
```

- All outbound calls are logged via Winston with secrets automatically redacted (headers that match `token`, `secret`, `password`, `authorization`, or `api-key` are masked by default).
- When `PLAYWRIGHT_DEBUG_API` is enabled, raw request/response bodies are included for debugging and appear inside the Playwright HTML report.
- Use `buildApiAttachment` to convert any logged call into a Playwright artefact with consistent naming.

#### Plugging into Playwright fixtures

Every consumer can share a single logger/API client across fixtures. The example below mirrors the wiring used in `tcoe-playwright-example`:

```ts
// fixtures.ts
import { test as base } from "@playwright/test";
import {
  ApiClient,
  createLogger,
  type ApiLogEntry,
} from "@hmcts/playwright-common";

type Fixtures = {
  logger: ReturnType<typeof createLogger>;
  capturedCalls: ApiLogEntry[];
  apiClient: ApiClient;
};

export const test = base.extend<Fixtures>({
  logger: async ({}, use, workerInfo) => {
    const logger = createLogger({
      serviceName: "case-service-ui",
      defaultMeta: { workerId: workerInfo.workerIndex },
    });
    await use(logger);
  },
  capturedCalls: async ({}, use) => {
    const calls: ApiLogEntry[] = [];
    await use(calls);
  },
  apiClient: async ({ logger, capturedCalls }, use, testInfo) => {
    const client = new ApiClient({
      baseUrl: process.env.BACKEND_BASE_URL,
      logger,
      onResponse: (entry) => capturedCalls.push(entry),
      captureRawBodies: process.env.PLAYWRIGHT_DEBUG_API === "1",
    });

    await use(client);
    await client.dispose();

    if (capturedCalls.length) {
      await testInfo.attach("api-calls.json", {
        body: JSON.stringify(capturedCalls, null, 2),
        contentType: "application/json",
      });
    }
  },
});
```

#### Customising redaction

- Pass `redactKeys: [/session/i, "x-api-key"]` when calling `createLogger`/`ApiClient` to mask additional headers or payload fields.
- Toggle masking at runtime by setting `LOG_REDACTION=off` (useful when debugging locally).
- `ApiClient` accepts `captureRawBodies: true` to include the pre-redaction payloads in the `logEntry.rawRequest/rawResponse` fields—only enabled automatically when `PLAYWRIGHT_DEBUG_API` is set.

### Logging Conventions

The shared logger provides consistent, structured output across utilities and test suites. Follow these guidelines when emitting log entries:

1. Use appropriate log levels:
  - `error`: Operational failures (failed API call, unexpected exception, timeout).
  - `warn`: Recoverable issues (retryable condition, degraded behavior, feature flag missing).
  - `info`: High-level lifecycle events (start/end of audit, navigation steps, token acquisition, polling start/finish).
  - `debug`: Developer-centric diagnostics (raw HTTP payloads, detailed validation decisions) – only enable locally or in short‑lived debug pipelines.
2. Prefer structured fields over string concatenation. Add contextual metadata via the `defaultMeta` option or per‑log call (e.g. `{ caseId, attempt, durationMs }`).
3. Avoid logging secrets or PII. Sensitive keys are auto‑masked; extend masking with `redactKeys` when introducing new secret‑bearing headers/fields.
4. Include timing metadata for performance‑sensitive operations. Examples:
  - Accessibility audits: `durationMs` and `reportDurationMs` in `AxeUtils.audit()` and `generateReport()`.
  - Polling utilities: elapsed time and attempt count in `WaitUtils.waitForLocatorVisibility` error logs.
5. When capturing API calls:
  - Use `onResponse` to push `ApiLogEntry` objects into an array for later attachment.
  - Convert into Playwright artefacts with `buildApiAttachment` to maintain consistent naming & formatting.
6. Prefer dependency injection of a shared logger instead of creating ad‑hoc instances inside utilities—this preserves test run correlation and worker metadata.
7. Disable redaction only when absolutely required for debugging (`LOG_REDACTION=off`) and NEVER commit artefacts containing live secrets.

Example (adding contextual metadata):

```ts
logger.info("starting accessibility audit", { pageName, axeTags, caseId });
// ... run audit
logger.info("accessibility audit complete", { pageName, durationMs, violations: results.violations.length });
```

Example (instrumenting a custom polling loop):

```ts
const start = performance.now();
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const visible = await locator.isVisible();
  if (visible) {
   logger.info("locator became visible", { attempt, durationMs: performance.now() - start });
   break;
  }
  await page.waitForTimeout(intervalMs);
}
```

If a utility needs to surface rich error details, serialise the body safely using `serialiseApiBody()` and log structured fields (`status`, `endpoint`, `method`, `bodyPreview`).

For consistency, avoid `console.log` in all test code—always use the shared logger; this ensures redaction, formatting, and central attachment readiness.

### Testing Changes

Run unit tests locally with:

```bash
yarn test

# Optional: run type-checks and linting just like CI
yarn lint
```

See [Contribution Guide](./CONTRIBUTING.md) for more info regarding testing changes & creating new release.
