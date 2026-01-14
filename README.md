# playwright-common

[![npm version](https://img.shields.io/npm/v/@hmcts/playwright-common.svg)](https://www.npmjs.com/package/@hmcts/playwright-common)
[![CI](https://github.com/hmcts/playwright-common/actions/workflows/ci.yml/badge.svg)](https://github.com/hmcts/playwright-common/actions/workflows/ci.yml)

This is the shared Playwright toolkit for HMCTS projects. It ships reusable page objects, logging/telemetry, configs, and pragmatic helpers so teams can focus on writing tests—not plumbing.

What you get:
- **Shared Page Objects & Components** for common HMCTS flows.
- **Configuration**: common/playwright/linting configs.
- **Utilities**: battle-tested helpers for API clients, waiting, validation, etc.
- **Observability Foundations**: Winston-based logger, redaction, instrumented API client with ready-to-attach artefacts (fail-closed on raw bodies unless `PLAYWRIGHT_DEBUG_API` is explicitly enabled).
- **Coverage + Endpoint utilities**: read c8 summaries, emit read friendly text/rows, and scan Playwright API specs for endpoint hit counts.

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

Default redaction coverage (headers/fields masked automatically):

- `authorization`, `token`, `secret`, `password`, `api-key`
- `x-xsrf-token`
- `cookie`, `set-cookie`
- `session`

You can extend/override patterns via `redaction.patterns` or `redactKeys` when creating the logger or API client.

## ApiClient guide

The `ApiClient` wraps Playwright’s `APIRequestContext` with:
- Redacted structured logging (Winston).
- Correlation IDs on every call (auto-generated if not supplied).
- Optional circuit breaker to stop hammering failing dependencies.
- Retry-friendly errors (carry `retryAfterMs`, `elapsedMs`, `endpointPath`, `correlationId`).
- Attachment builder for test artefacts.
- Fail-closed raw bodies: only included when `PLAYWRIGHT_DEBUG_API` is `true`/`1` or `NODE_ENV=development`.

Example:
```ts
import { ApiClient, buildApiAttachment, isRetryableError, withRetry } from "@hmcts/playwright-common";

const api = new ApiClient({
  baseUrl: process.env.BACKEND_BASE_URL,
  name: "backend",
  circuitBreaker: { enabled: true, options: { failureThreshold: 5, cooldownMs: 30000 } },
  captureRawBodies: false, // safe default for CI
  onError: (err) => {
    // centralised telemetry hook
    console.error("api error", { status: err.status, retryAfterMs: err.retryAfterMs, correlationId: err.correlationId });
  },
});

const res = await withRetry(
  () => api.get("/health", { throwOnError: true }),
  3,
  200,
  2000,
  15000,
  isRetryableError
);
```

Attachment safety:
```ts
const entry = /* ApiLogEntry */;
const attachment = buildApiAttachment(entry, { includeRaw: true }); // raw only when debug env is on
```

Default timeout: 30s per request (override via `timeoutMs` per call).

## Security Best Practices

⚠️ **CRITICAL: Never enable `PLAYWRIGHT_DEBUG_API=true` in CI/production environments**
- Raw request/response bodies will be logged when debug mode is enabled
- This may expose secrets, tokens, and other sensitive data in test artifacts
- Only enable locally for debugging specific issues
- Always use redacted attachments in pipelines (default behavior)
- The ApiClient will emit a warning if debug mode is detected in production

⚠️ **CVE Mitigations Applied**
- `glob@^11.0.0` - Fixes command injection vulnerability (CVE-2024-XXXX)
- `esbuild@^0.23.0` - Fixes SSRF vulnerability in dev server
- Yarn resolutions ensure these security patches are enforced across all dependencies

⚠️ **Redaction Best Practices**
- Default patterns cover: `token`, `secret`, `password`, `authorization`, `api-key`
- Extend patterns via `redaction.patterns` if you use custom secret field names
- Use `LOG_REDACTION=off` only for local debugging, never in CI
- Test artifacts use redacted values by default - this is intentional and safe

## Env vars at a glance
- Logging: `LOG_LEVEL`, `LOG_FORMAT`, `LOG_REDACTION`, `LOG_SERVICE_NAME`
- Debug API bodies: `PLAYWRIGHT_DEBUG_API` (`true`/`1` to allow raw payloads in attachments) **⚠️ Never in CI!**
- IDAM: `IDAM_WEB_URL`, `IDAM_TESTING_SUPPORT_URL`, optional `IDAM_RETRY_ATTEMPTS`, `IDAM_RETRY_BASE_MS`
- S2S: `S2S_URL`, `S2S_SECRET`, optional `S2S_RETRY_ATTEMPTS`, `S2S_RETRY_BASE_MS`
- Playwright workers: `FUNCTIONAL_TESTS_WORKERS`
- PW debug: `PWDEBUG` (`true`/`1` to emit extra Axe logging)

## Troubleshooting & FAQ
- **Breaker open / repeated 5xx**: enable circuit breaker + retry; respect `retryAfterMs` when present.
- **Missing raw bodies in attachments**: expected in CI. Set `PLAYWRIGHT_DEBUG_API=true` locally if you need raw payloads; keep `includeRaw=false` in pipelines.
- **Endpoint scanner misses dynamic paths**: pass `useAst:true` and avoid heavily dynamic template strings; regex fallback is simpler but less precise.
- **Timeouts**: default 30s; set `timeoutMs` per call for stricter budgets.
- **Redaction**: extend `redaction.patterns` or `loggerOptions.redactKeys` if you see sensitive fields; raw bodies gated behind debug reduce leakage risk.

## CI/publishing notes
Publishing is handled by GitHub Actions using Trusted Publishing (OIDC).

Pre-releases: push a tag matching prerelease-* (publishes with npm dist-tag prerelease)
Quick trigger: yarn prerelease
Releases: publish a GitHub Release (Release UI)
See CONTRIBUTING.md for the full procedure and versioning conventions.

- `prepack` runs `yarn build` before publish.
- Publish/archive artefacts:
  - `coverage/coverage-summary.txt` and `coverage/coverage-summary-rows.json`
  - `coverage/api-endpoints.json`
  - Use Odhin/Playwright tabs to render coverage/endpoint rows.

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

#### Optional Retry (IDAM/S2S)

Transient network or gateway issues (e.g., 502/504, ECONNRESET) can be handled with opt-in retry/backoff controlled by environment variables:

- `IDAM_RETRY_ATTEMPTS` and `IDAM_RETRY_BASE_MS` – applies to `IdamUtils.generateIdamToken`.
- `S2S_RETRY_ATTEMPTS` and `S2S_RETRY_BASE_MS` – applies to `ServiceAuthUtils.retrieveToken`.

Example:

```env
IDAM_RETRY_ATTEMPTS=3
IDAM_RETRY_BASE_MS=200
S2S_RETRY_ATTEMPTS=3
S2S_RETRY_BASE_MS=200
```

This uses an exponential backoff with jitter. Set attempts to `1` to disable.

### Coverage utilities
Parse `coverage-summary.json` from c8/Istanbul and produce text + table-ready rows you can inject into reports or publish as build artefacts.

```ts
import { readCoverageSummary, buildCoverageRows } from "@hmcts/playwright-common";

const summary = readCoverageSummary("./reports/tests/coverage/api-playwright/coverage-summary.json");
if (!summary) {
  console.log("No coverage available");
} else {
  console.log(summary.textSummary);
  const rows = buildCoverageRows(summary.totals); // normalised rows for HTML/Markdown tables
}
```

### API endpoint scanner
Supports two modes:

1. Regex scanning (default): fast, works with common client call shapes.
2. AST scanning (`useAst: true`): uses `ts-morph` for more accurate parsing of `apiClient.get("/path")` forms (skips dynamic template expressions).

```ts
import { scanApiEndpoints } from "@hmcts/playwright-common";

// Regex mode (default)
const basic = scanApiEndpoints("./playwright_tests_new/api");

// AST mode
const ast = scanApiEndpoints("./playwright_tests_new/api", { useAst: true });
import { formatEndpointHitsMarkdown } from "@hmcts/playwright-common";

const table = formatEndpointHitsMarkdown(ast); // returns a markdown table string
console.log(table);
```

If AST mode fails (e.g. parser not available), it silently falls back to regex.

#### Formatting endpoint results

`formatEndpointHitsMarkdown(result)` builds a ready-to-paste Markdown table:

```markdown
| Endpoint | Hits |
|----------|------|
| /health  | 1    |
| /token   | 2    |

Total Hits: 3
```

Pass either the full scan result or an array of `{ endpoint, hits }`.

```ts
const result = scanApiEndpoints('./tests/api');
const markdown = formatEndpointHitsMarkdown(result);
writeFileSync('endpoint-hits.md', markdown);
```

### Retry utility

Use a simple exponential backoff helper for transient operations (network/API calls, polling):

```ts
import { withRetry } from "@hmcts/playwright-common";

const result = await withRetry(() => apiClient.get<any>("/health"), 3, 200);
```

Internally, `IdamUtils` and `ServiceAuthUtils` can leverage the same helper via the opt-in environment variables above.

#### Retry Configuration Constants

The library exports immutable default constants you can reference:

```ts
import { 
  DEFAULT_RETRY_ATTEMPTS,     // 3
  DEFAULT_RETRY_BASE_MS,      // 200
  DEFAULT_RETRY_MAX_MS,       // 2000
  DEFAULT_RETRY_MAX_ELAPSED_MS // 15000
} from "@hmcts/playwright-common";

// Use for consistency across your test suite
await withRetry(() => apiCall(), DEFAULT_RETRY_ATTEMPTS);
```

#### Parameter Validation & Safety

The `withRetry` function validates all parameters:
- `attempts` must be ≥ 1
- `baseMs`, `maxMs`, and `maxElapsedMs` must be non-negative
- `maxElapsedMs` must be > 0 (prevents immediate timeout)
- `maxMs` must be ≥ `baseMs`
- `Retry-After` headers are capped at 60 seconds to prevent excessive delays from misbehaving servers

Invalid parameters throw descriptive errors immediately:

```ts
// ❌ Throws: "retry attempts must be >= 1, got 0"
await withRetry(() => apiCall(), 0);

// ❌ Throws: "retry delay parameters must be non-negative (maxElapsedMs must be > 0)"
await withRetry(() => apiCall(), 3, 200, 2000, 0);
```

Advanced usage:

```ts
import { withRetry, isRetryableError } from "@hmcts/playwright-common";

// Retry only transient failures (5xx, 429, and common network errors)
await withRetry(() => apiClient.get("/status"), 3, 200, 2000, 15000, isRetryableError);
```

### Redaction patterns (security)

By default, the logger/API client masks common sensitive fields and headers, including tokens, secrets, passwords, Authorization, API keys, XSRF tokens, cookies, Set-Cookie, and session keys. Extend or override via `redactKeys` or `redaction.patterns` when creating the logger/client.

Attachment redaction:
- `buildApiAttachment(entry, { includeRaw })` omits `rawRequest/rawResponse` when `includeRaw=false` (recommended in CI).
- When `includeRaw=true` (e.g., local debugging), raw payloads are included—ensure redaction toggles remain ON.

### Circuit breaker (resilience)

Add a minimal circuit breaker to prevent hammering failing services:

```ts
import { ApiClient } from "@hmcts/playwright-common";

const client = new ApiClient({
  baseUrl: process.env.BACKEND_BASE_URL,
  name: "backend",
  circuitBreaker: {
    enabled: true,
    options: { failureThreshold: 5, cooldownMs: 30000, halfOpenMaxAttempts: 2 },
  },
  onError: (err) => {
    // Push to telemetry or aggregate metrics
    myTelemetry.record("api-error", { status: err.status, endpoint: err.logEntry.url });
  },
});
```

Behavior:
- **Closed**: requests flow normally.
- **Open**: requests blocked until `cooldownMs` elapses.
- **Half-open**: limited trial attempts; success closes the circuit, failure re-opens.

#### Circuit Breaker Validation

The circuit breaker validates configuration parameters:
- `failureThreshold` must be ≥ 1
- `cooldownMs` must be ≥ 0
- `halfOpenMaxAttempts` must be ≥ 1

Invalid options throw descriptive errors:

```ts
// ❌ Throws: "failureThreshold must be >= 1, got 0"
new CircuitBreaker({ failureThreshold: 0 });

// ❌ Throws: "halfOpenMaxAttempts must be >= 1, got 0"
new CircuitBreaker({ halfOpenMaxAttempts: 0 });
```

**Concurrency Safety**: The circuit breaker is safe for Node.js async concurrent operations. Trial counters are incremented atomically when `canProceed()` is called to prevent race conditions in the half-open state.

#### Circuit breaker metrics

Capture a lightweight snapshot for telemetry dashboards or Prometheus exporters:

```ts
import { ApiClient } from "@hmcts/playwright-common";

const client = new ApiClient({
  baseUrl: process.env.BACKEND_BASE_URL,
  circuitBreaker: { enabled: true },
});

const metrics = client.getCircuitBreakerMetrics();
/* Example shape:
{
  state: "closed",            // "closed" | "open" | "half-open"
  failureCount: 0,             // accumulated consecutive failures
  failureThreshold: 5,         // configured threshold to open
  cooldownMs: 30000,           // open state duration before half-open trial
  halfOpenMaxAttempts: 2,      // number of trial calls in half-open
  openedAt?: 1732800000000,    // epoch ms when circuit entered open (undefined if never opened)
  lastFailureAt?: 1732800000000,// epoch ms of last failure (undefined if none)
  halfOpenTrialCount?: 0       // number of trial attempts made while half-open
}
*/

// Push to metrics system
if (metrics) {
  recordGauge('circuit_state', metrics.state === 'open' ? 2 : metrics.state === 'half-open' ? 1 : 0);
  recordGauge('circuit_failures', metrics.failureCount);
}
```

Metrics are instantaneous; poll on an interval (e.g. every test or per request in `onError`) to build time‑series.

### Error enrichment

`ApiClientError` now includes:
- `bodyPreview` – truncated (2KB) representation of the response body
- `endpointPath` – resolved absolute endpoint
- `elapsedMs` – request duration
- `attempt` – reserved for future multi-attempt integrations (e.g. composed retries)

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
- Attach API calls safely: `buildApiAttachment` will only include raw bodies when `PLAYWRIGHT_DEBUG_API` is true/1 or `NODE_ENV=development` (fail-closed for CI). Leave `includeRaw=false` for pipeline artefacts.

Goal: every pipeline run should tell people “what we covered” and “which APIs we hit” without bizzare artefacts.
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

#### Redaction extension recipes

You can inject additional masking rules via either a high-level key list (`redactKeys`) or raw regex patterns (`redaction.patterns`).

```ts
const logger = createLogger({
  serviceName: 'payments-tests',
  redactKeys: [/^x-pay-token$/i, /customerId/i], // key match (headers + payload)
});

const client = new ApiClient({
  baseUrl: process.env.PAY_API_URL,
  redaction: {
    enabled: true,
    patterns: [
      { type: 'header', pattern: /x-session-id/i },
      { type: 'body', pattern: /"sessionId"\s*:/i },
    ],
  },
});
```

Performance notes:
- Redaction runs a lightweight traversal; each additional regex adds a small cost proportional to payload size (headers + JSON string length). For typical test payloads (< 50KB) dozens of patterns remain cheap.
- Prefer anchored or narrowly‑scoped regexes (e.g. `/^authorization$/i` instead of `/auth/i`) to reduce backtracking.
- If you need heavy dynamic logic (e.g. decrypt then mask), perform that before calling the logger/client and keep redaction patterns simple.
- Disable masking temporarily with `LOG_REDACTION=off` only for local debugging. Never ship artefacts produced with masking disabled.

Advanced pattern strategy:
1. Start with broad defaults (already included).
2. Add explicit service-specific secrets (e.g. payment tokens) using exact header names.
3. Add body field patterns only when they cannot be caught via key matching (e.g. nested serialized blobs).
4. Periodically scan logs in CI for unmasked high-entropy values and promote new patterns.

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

## Example Environment (.env.example)

See `.env.example` in the repo root for secure defaults and toggles used in CI.

## Changelog Highlights

- Expanded default redaction patterns (XSRF, cookies, session) to prevent secret leakage in logs and attachments.
- Added `withRetry` utility and opt-in wiring for IDAM/S2S token requests via environment variables.
- Attachment redaction behavior clarified; tests ensure raw bodies are excluded unless explicitly enabled.
- Introduced circuit breaker with `onError` hook in `ApiClient` for resilience and observability.
