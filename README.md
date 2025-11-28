# playwright-common

This is the shared Playwright toolkit for HMCTS projects. It ships reusable page objects, logging/telemetry, configs, and pragmatic helpers so teams can focus on writing tests—not plumbing.

What you get:
- **Shared Page Objects & Components** for common HMCTS flows.
- **Configuration**: common/playwright/linting configs.
- **Utilities**: battle-tested helpers for API clients, waiting, validation, etc.
- **Observability Foundations**: Winston-based logger, redaction, instrumented API client with ready-to-attach artefacts.
- **Coverage + Endpoint utilities**: read c8 summaries, emit human-friendly text/rows, and scan Playwright API specs for endpoint hit counts.

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
`ServiceAuthUtils` is the helper that talks to the HMCTS service-to-service (S2S) gateway. It always needs the gateway URL, but you get to choose how to provide the secret:

- Set `S2S_URL` in your environment (required).
- Decide how the secret is supplied:
  - **Environment variable** – set `S2S_SECRET` once and share it across every request.
  - **Constructor option** – pass `secret` when you create the helper so the value can come straight from a secret store.
  - **Per call** – include `secret` in `ServiceTokenParams` if the value varies by microservice.

The lookup order is _per call → constructor → environment_. If all three are empty the helper keeps the legacy behaviour: it logs an informational message and sends the request without an `Authorization` header. (Most HMCTS services still require a secret, so expect the gateway to reject the call—this just avoids breaking older projects that relied on the previous implementation.)

**AAT shared-secret example**
```env
S2S_URL=http://rpe-service-auth-provider-aat.service.core-compute-aat.internal/testing-support/lease
S2S_SECRET=<fetch from Azure Key Vault>
```
**DEMO shared-secret example**
```env
S2S_URL=http://rpe-service-auth-provider-demo.service.core-compute-demo.internal/testing-support/lease
S2S_SECRET=<fetch from Azure Key Vault>
```

**Constructor secret example**  
Good when you fetch the secret from a vault at startup.
```ts
const utils = new ServiceAuthUtils({
  secret: getSecretFromVault(), // keeps the secret out of env vars
});
```

**Per-request secret example**  
Use this when each microservice has its own lease secret.
```ts
const token = await utils.retrieveToken({
  microservice: "my-service",
  secret: getSecretFor("my-service"),
});
```

> **Why does the helper still demand a secret?**  
> The HMCTS S2S gateway almost always expects both a microservice name and a matching secret. Allowing `S2S_SECRET` to be optional simply lets you fetch or compute the value at runtime. When no secret is provided the helper now logs `"No S2S secret provided; sending request without Authorization header."` and performs the request exactly as the pre‑1.0.37 version did—useful for legacy suites that never set a secret. Newer suites should continue to send a secret to avoid 401 responses.

### Coverage utilities
Parse `coverage-summary.json` from c8/Istanbul and produce text + table-ready rows you can inject into reports or publish as build artefacts.

```ts
import { readCoverageSummary, buildCoverageRows } from "@hmcts/playwright-common";

const summary = readCoverageSummary("./reports/tests/coverage/api-playwright/coverage-summary.json");
if (!summary) {
  console.log("No coverage available");
} else {
  console.log(summary.textSummary);           // human-friendly block for a .txt artefact
  const rows = buildCoverageRows(summary.totals); // normalised rows for HTML/Markdown tables
}
```

### API endpoint scanner

Count API client calls in your Playwright specs to show what endpoints are being exercised (great for dashboards and test gap hunting).

```ts
import { scanApiEndpoints } from "@hmcts/playwright-common";

const { endpoints, totalHits } = scanApiEndpoints("./playwright_tests_new/api");
// endpoints: sorted array of { endpoint, hits }, totalHits: total calls found
```

If your client shape differs, override the pattern/extension:

```ts
scanApiEndpoints("./tests/api", {
  callPattern: /callApi\(["']([^"']+)["']\)/g,
  endpointGroup: 1,
  extensions: [".js"],
});
```

### Suggested CI wiring

- Run your coverage-enabled Playwright task (e.g. `c8 ... playwright test ...`) to produce `coverage-summary.json`.
- Call `readCoverageSummary`/`buildCoverageRows` in a script to emit:
  - `coverage-summary.txt` (attach/publish in CI)
  - Optional JSON rows for injecting into HTML dashboards (Odhin/Playwright reports)
- Use `scanApiEndpoints` against your API spec folder and publish the resulting JSON; it makes “tested endpoints” tabs trivial to render.

Human-friendly goal: every pipeline run should tell people “what we covered” and “which APIs we hit” without spelunking artefacts.
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
