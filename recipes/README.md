# Recipes (copy-paste friendly)

Short, opinionated examples you can lift into your project to get value fast.

## Backend ApiClient with circuit breaker + retry

See `backend-client-example.ts` for a minimal setup:
- Shared `ApiClient` with circuit breaker enabled.
- Retries tuned for transient failures (`isRetryableError`).
- `onError` hook emits telemetry; attachments are redacted.

Usage tips:
- Set `BACKEND_BASE_URL` in your env.
- Tune breaker thresholds/retries in options/env; keep `includeRaw=false` in CI.

## Coverage + endpoint reports (CI-friendly)

Script sketch (works with `@hmcts/playwright-common` coverage/endpoint utilities):
```ts
import { readCoverageSummary, buildCoverageRows, scanApiEndpoints } from "@hmcts/playwright-common";
import fs from "node:fs";
import path from "node:path";

const summary = readCoverageSummary("./coverage/coverage-summary.json");
if (summary) {
  fs.writeFileSync("./coverage/coverage-summary.txt", summary.textSummary, "utf8");
  fs.writeFileSync("./coverage/coverage-summary-rows.json", JSON.stringify(buildCoverageRows(summary.totals), null, 2));
}
const { endpoints, totalHits } = scanApiEndpoints("./tests/api");
fs.writeFileSync("./coverage/api-endpoints.json", JSON.stringify({ totalHits, endpoints }, null, 2));
```
Archive the `.txt` and `.json` outputs in CI to givea quick view of “what is covered” and “which APIs been hit.”

## Retry tuned for 429 (Retry-After aware)

```ts
import { withRetry, isRetryableError } from "@hmcts/playwright-common";

async function callWith429AwareRetry(fn: () => Promise<unknown>) {
  return withRetry(
    async () => fn(),
    3,      // attempts
    200,    // base backoff
    2000,   // max backoff
    15000,  // max elapsed
    (err) => {
      if (!isRetryableError(err)) return false;
      const retryAfter = (err as any)?.retryAfterMs;
      if (typeof retryAfter === "number" && retryAfter > 0) {
        // simple sleep honoring Retry-After
        return new Promise((res) => setTimeout(res, retryAfter)).then(() => true);
      }
      return true;
    }
  );
}
```

## Local-only raw payloads (fail-closed elsewhere)

```ts
import { ApiClient } from "@hmcts/playwright-common";

const captureRawBodies =
  process.env.NODE_ENV === "development" &&
  process.env.PLAYWRIGHT_DEBUG_API === "true";

const apiClient = new ApiClient({
  captureRawBodies,
  redaction: { enabled: true },
  onResponse: (entry) => {
    if (!entry.ok) {
      // surface a warn when raw bodies are disabled to avoid surprises
      console.warn("Raw bodies are disabled; relying on redacted payloads only.");
    }
  },
});
```

## Fixture wiring for attachments

```ts
// playwright.config.ts
import { buildApiAttachment } from "@hmcts/playwright-common";

test.afterEach(async ({ apiClient }, testInfo) => {
  const calls = apiClient.getCapturedCalls?.(); // if your wrapper stores them
  for (const call of calls ?? []) {
    testInfo.attachments.push(
      buildApiAttachment(call, { includeRaw: false })
    );
  }
});
```

If you need another recipe, add a short snippet here—keep it runnable and annotated for future you.
