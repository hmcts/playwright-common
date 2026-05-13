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

### Local package testing (consume like a published package)

Build and pack the library, then install the tarball in your consuming project:

```bash
# In playwright-common
yarn build
yarn pack -o /tmp/playwright-common.tgz

# In your consuming project
yarn add -D /tmp/playwright-common.tgz
```

For local development without packing, you can also use Yarn portal from the consuming project:

```bash
yarn add -D @hmcts/playwright-common@portal:../playwright-common
```

## UI Mode and Trace Viewer (Playwright 1.58+)

UI Mode is the recommended way to run tests locally with the Trace Viewer.
The 1.58 release adds a system theme option, in-editor search, improved network
panel layout, and formatted JSON responses in the Trace Viewer.

Example commands (in your consuming repo):
```bash
# UI Mode (interactive runner + trace viewer)
yarn playwright test --ui

# Always record full traces from CLI
yarn playwright test --trace on

# Open a saved trace file
npx playwright show-trace path/to/trace.zip
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

The CI pipeline runs `yarn build` before publishing.

The following artifacts are generated by consuming projects (not this library) and can be archived in CI builds:
  - `coverage/coverage-summary.txt` and `coverage/coverage-summary-rows.json`
  - `coverage/api-endpoints.json`

These files can be used to render coverage and endpoint data in custom report tabs (e.g., in Playwright or other reporting tools). Use Odhin/Playwright tabs to render coverage/endpoint rows.  

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

### TableUtils guide

The `TableUtils` class provides robust, production-tested methods to parse various table formats used in HMCTS applications. All methods handle edge cases like hidden rows (including `aria-hidden`), nested tables, sort icons, and whitespace normalization. Empty value cells return empty strings; visible key/label cells must have content and will throw if missing.

---

## Overview

`TableUtils` offers three specialized table parsing methods plus legacy helpers:

| Method | Use Case | Returns |
|--------|----------|---------|
| `parseKeyValueTable` | CCD case details, property lists (2-column: label → value) | `Record<string, string>` |
| `parseDataTable` | Documents, collections, multi-column tables with headers | `Array<Record<string, string>>` |
| `parseWorkAllocationTable` | Work allocation tables with sortable headers and links | `Array<Record<string, string>>` |
| `mapExuiTable` (legacy) | EXUI tables with sort icons | `string[][]` |
| `mapCitizenTable` (legacy) | Citizen UI tables | `string[][]` |

All methods:
- ✅ Filter hidden/invisible rows automatically
- ✅ Ignore nested tables by scoping rows to the target table element
- ✅ Remove Unicode sort icons (▼▲↑↓⋀⋁)
- ✅ Normalize whitespace (trim, collapse multiple spaces)
- ✅ Execute in browser context (proper DOM access)
- ✅ Provide detailed error messages with selector context

---

## Method 1: `parseKeyValueTable` – CCD Case Details & Property Lists

### When to Use
Use this for **2-column tables** where the first column contains labels/keys and subsequent columns contain values:
- CCD case details tabs
- Property lists
- Configuration tables
- Summary panels

### Signature
```ts
parseKeyValueTable(
  selector: string | Locator,
  page?: Page
): Promise<Record<string, string>>
```

### Basic Example
```ts
import { TableUtils } from "@hmcts/playwright-common";

const utils = new TableUtils();

// Parse CCD case details
const caseDetails = await utils.parseKeyValueTable("#case-details-table", page);

// Access values by label
expect(caseDetails["Case Reference"]).toBe("1234567890123456");
expect(caseDetails["Status"]).toBe("Open");
expect(caseDetails["Case Type"]).toBe("Civil");
```

### Using Locator (no Page required)
```ts
// When you already have a Locator, no need for page
const detailsLocator = page.locator(".case-viewer ccd-case-view-tab");
const details = await utils.parseKeyValueTable(detailsLocator);

// Works with chained locators
const addressDetails = await utils.parseKeyValueTable(
  page.locator("#address-section").locator("table")
);
```

### Handling Multi-Column Values
When the value spans multiple columns, they're automatically joined with spaces:

```ts
// HTML structure:
// | Label        | Value Part 1 | Value Part 2 | Value Part 3 |
// | Address      | 123 Main St  | London       | SW1A 1AA     |

const data = await utils.parseKeyValueTable("#address-table", page);
expect(data["Address"]).toBe("123 Main St London SW1A 1AA");
```

### Sort Icons Are Removed Automatically
```ts
// HTML: <td>Case Reference ▼</td>
// Result: "Case Reference" (sort icon removed)

const data = await utils.parseKeyValueTable("#sorted-table", page);
expect(data["Case Reference"]).not.toContain("▼");
expect(data["Status"]).not.toContain("▲");
```

### Edge Cases Handled

**Empty value cells return empty string; empty keys throw:**
```ts
// Table with empty value:
// | Label        | Value  |
// | Case Ref     | 12345  |  ← valid (key + value)
// | Note         |        |  ← valid (key present, empty value returns "")
// |              | Data   |  ← throws (empty key)

const data = await utils.parseKeyValueTable("#table", page);
expect(data["Case Ref"]).toBe("12345");
expect(data["Note"]).toBe(""); // Empty value cells return empty string

await expect(utils.parseKeyValueTable("#table-with-empty-key", page))
  .rejects.toThrow("Failed to extract text from visible key cell");
```

**Empty or single-column rows are skipped:**
```ts
// Table with invalid rows:
// | Case Reference | 12345 |  ← valid (2+ columns)
// | Empty Row      |        ← skipped (only 1 column)
// |                |        ← skipped (empty key)
// | Status         | Open | ← valid

const data = await utils.parseKeyValueTable("#table", page);
// Only returns valid rows with non-empty keys
expect(Object.keys(data)).toEqual(["Case Reference", "Status"]);
```

**Hidden rows are filtered:**
```ts
// Rows with display:none, visibility:hidden, hidden attribute,
// or zero client rects are automatically excluded
const data = await utils.parseKeyValueTable("#table", page);
// Only visible rows appear in result
```

### Error Handling
```ts
// ❌ Missing page parameter for string selector
await utils.parseKeyValueTable("#table");
// Throws: "Page instance required for string selectors"

// ❌ Empty selector
await utils.parseKeyValueTable("", page);
// Throws: "Selector cannot be empty"

// ❌ Page crashes during evaluation
await utils.parseKeyValueTable("#table", crashedPage);
// Throws: "Failed to evaluate table (#table): Target page, context or browser has been closed"
```

### Complete Working Example
```ts
import { test, expect } from "@playwright/test";
import { TableUtils } from "@hmcts/playwright-common";

test("verify case details from CCD table", async ({ page }) => {
  const utils = new TableUtils();
  
  await page.goto("/case/1234567890123456");
  await page.click('text="Case Details"'); // Open tab
  
  const details = await utils.parseKeyValueTable(
    "#case-details-table tbody",
    page
  );
  
  // Assert expected values
  expect(details["Case Reference"]).toBe("1234567890123456");
  expect(details["Applicant Name"]).toContain("John Doe");
  expect(details["Submission Date"]).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  
  // Log all extracted data
  console.log("Case Details:", JSON.stringify(details, null, 2));
});
```

---

## Method 2: `parseDataTable` – Multi-Column Tables with Headers

### When to Use
Use this for **multi-column data tables** with headers:
- Document lists
- Flag collections
- Party lists
- Order tables
- Any table where each row represents a data record

### Signature
```ts
parseDataTable(
  selector: string | Locator,
  page?: Page
): Promise<Array<Record<string, string>>>
```

### Basic Example with `<thead>`
```ts
const utils = new TableUtils();

// Parse document table (has <thead> element)
// Note: <thead> rows are automatically excluded from data
const documents = await utils.parseDataTable("#documents-table", page);

// Result is array of objects, one per data row
expect(documents).toHaveLength(3);
expect(documents[0]).toEqual({
  "Document Name": "Application.pdf",
  "Upload Date": "2025-01-15",
  "Uploaded By": "John Doe",
  "Status": "Verified"
});

// Access individual rows
const firstDoc = documents[0];
expect(firstDoc["Document Name"]).toBe("Application.pdf");

// Filter results
const pendingDocs = documents.filter(d => d["Status"] === "Pending");
```

### Tables Without `<thead>` (Header Row Uses `<th>`)
```ts
// When table lacks <thead>, a first row with <th> cells becomes headers
// HTML:
// <tr><th>Name</th><th>Role</th><th>Email</th></tr>
// <tr><td>Alice</td><td>Admin</td><td>alice@hmcts.net</td></tr>
// <tr><td>Bob</td><td>User</td><td>bob@hmcts.net</td></tr>

const users = await utils.parseDataTable("#users-table", page);

// First data row uses first row values as headers
expect(users).toEqual([
  { Name: "Alice", Role: "Admin", Email: "alice@hmcts.net" },
  { Name: "Bob", Role: "User", Email: "bob@hmcts.net" }
]);
```

### Headerless Tables (No `<thead>` and No `<th>`)
```ts
// When a table has no header row, fallback column_N keys are used
// HTML:
// <tr><td>Alice</td><td>Admin</td><td>alice@hmcts.net</td></tr>
// <tr><td>Bob</td><td>User</td><td>bob@hmcts.net</td></tr>

const data = await utils.parseDataTable("#table", page);

expect(data[0]).toEqual({
  column_1: "Alice",
  column_2: "Admin",
  column_3: "alice@hmcts.net"
});
```

### Fallback Column Names for Missing Headers
```ts
// When headers are empty or missing, generates column_N
// HTML: <thead><tr><th>Name</th><th></th><th>Status</th></tr></thead>

const data = await utils.parseDataTable("#table", page);

expect(data[0]).toEqual({
  "Name": "Alice",
  "column_2": "alice@hmcts.net",  // ← fallback for empty header
  "Status": "Active"
});
```

### Sort Icons Removed from Headers and Cells
```ts
// Headers: "Document Name ▼" → "Document Name"
// Cells: "Application.pdf ↑" → "Application.pdf"

const docs = await utils.parseDataTable("#sorted-table", page);
expect(docs[0]["Document Name"]).not.toContain("▼");
```

### Whitespace Normalization
```ts
// HTML:
// <td>  Alice   Smith  </td>  (multiple spaces)
// <td>
//   Bob
//   Jones
// </td>  (newlines and tabs)

const data = await utils.parseDataTable("#table", page);

// All whitespace normalized to single spaces
expect(data[0]["Name"]).toBe("Alice Smith");
expect(data[1]["Name"]).toBe("Bob Jones");
```

### Edge Cases Handled

**Empty tables return empty array:**
```ts
const empty = await utils.parseDataTable("#empty-table", page);
expect(empty).toEqual([]);
```

**Hidden rows excluded:**
```ts
// Table with 5 rows, but 2 hidden (display:none)
const visible = await utils.parseDataTable("#table", page);
expect(visible).toHaveLength(3); // Only visible rows
```

**Rows with no cells skipped:**
```ts
// Empty <tr></tr> rows are automatically filtered
```

**Nested tables ignored:**
```ts
// Rows from nested tables inside cells are excluded
```

### Practical Examples

**Document verification test:**
```ts
test("verify all required documents uploaded", async ({ page }) => {
  const utils = new TableUtils();
  
  await page.goto("/case/1234567890123456/documents");
  
  const docs = await utils.parseDataTable("#documents-table", page);
  
  const requiredDocs = [
    "Application Form",
    "Proof of Identity",
    "Supporting Evidence"
  ];
  
  for (const required of requiredDocs) {
    const found = docs.find(d => d["Document Name"] === required);
    expect(found, `Missing required document: ${required}`).toBeDefined();
    expect(found?.["Status"]).toBe("Verified");
  }
});
```

**Extract specific columns:**
```ts
test("extract all document URLs", async ({ page }) => {
  const utils = new TableUtils();
  
  const docs = await utils.parseDataTable("#documents-table", page);
  
  // Extract just the URLs column
  const urls = docs.map(row => row["Download Link"]);
  
  // Verify all URLs valid
  for (const url of urls) {
    expect(url).toMatch(/^https:\/\/dm-store/);
  }
});
```

**Dynamic column access:**
```ts
test("flexible table parsing", async ({ page }) => {
  const utils = new TableUtils();
  
  const table = await utils.parseDataTable(".case-table", page);
  
  // Get all column names dynamically
  const headers = Object.keys(table[0] || {});
  console.log("Table columns:", headers);
  
  // Find column containing "Date"
  const dateColumn = headers.find(h => h.includes("Date"));
  if (dateColumn) {
    const dates = table.map(row => row[dateColumn]);
    console.log("All dates:", dates);
  }
});
```

**Combine with Playwright assertions:**
```ts
import { expect } from "@playwright/test";

test("verify party details", async ({ page }) => {
  const utils = new TableUtils();
  
  const parties = await utils.parseDataTable("#parties-table", page);
  
  // Use Playwright's rich assertions
  await expect(parties).toHaveLength(2);
  
  const applicant = parties.find(p => p["Party Type"] === "Applicant");
  await expect(applicant?.["Name"]).toBeTruthy();
  await expect(applicant?.["Legal Rep"]).toContain("Solicitors");
});
```

---

## Method 3: `parseWorkAllocationTable` – Work Allocation & Task Tables

### When to Use
Use this for **work allocation tables** with:
- Sortable headers (buttons inside `<th>`)
- Clickable cells (links inside `<td>`)
- ARIA hidden rows
- Performance-sensitive scenarios (uses parallel processing)

Common in:
- Work allocation queues
- Task lists
- Case assignment tables
- MyWork dashboards

### Signature
```ts
parseWorkAllocationTable(
  tableLocator: Locator
): Promise<Array<Record<string, string>>>
```

⚠️ **Note:** Unlike other methods, this **only accepts Locator** (not string selector).

### Basic Example
```ts
const utils = new TableUtils();

// Must use Locator (not string selector)
const tasks = await utils.parseWorkAllocationTable(
  page.locator("#work-allocation-table")
);

expect(tasks[0]).toEqual({
  "Case Reference": "1234567890123456",
  "Task": "Review application",
  "Assignee": "John Doe",
  "Priority": "High",
  "Due Date": "2025-01-25"
});
```

### Extracts Text from Buttons in Headers
```ts
// HTML header structure:
// <thead>
//   <tr>
//     <th><button>Case Reference ▼</button></th>
//     <th><button>Task</button></th>
//   </tr>
// </thead>

const tasks = await utils.parseWorkAllocationTable(table);

// Headers extracted from button text, sort icons removed
const firstTask = tasks[0];
expect(Object.keys(firstTask)).toContain("Case Reference");
expect(Object.keys(firstTask)).not.toContain("Case Reference ▼");
```

### Extracts Text from Links in Cells
```ts
// HTML cell structure:
// <td><a href="/case/12345">1234567890123456</a></td>
// <td><a href="/task/67890">Review application</a></td>

const tasks = await utils.parseWorkAllocationTable(table);

// Link text extracted, not href
expect(tasks[0]["Case Reference"]).toBe("1234567890123456");
expect(tasks[0]["Task"]).toBe("Review application");
```

### Hidden Rows Excluded (Comprehensive Filtering)
```ts
// Filters out rows that are hidden by multiple mechanisms:
// - aria-hidden="true"
// - display: none (CSS)
// - visibility: hidden (CSS)
// - hidden attribute
// - Zero client rects (not rendered)

// HTML:
// <tr><td>Task 1</td></tr>  ← included
// <tr aria-hidden="true"><td>Loading...</td></tr>  ← excluded
// <tr style="display:none"><td>Hidden</td></tr>  ← excluded
// <tr style="visibility:hidden"><td>Invisible</td></tr>  ← excluded
// <tr hidden><td>Template</td></tr>  ← excluded
// <tr><td>Task 2</td></tr>  ← included

const tasks = await utils.parseWorkAllocationTable(table);
expect(tasks).toHaveLength(2); // Only visible rows included
```

### Sort Icons Removed from Headers and Cells
```ts
// Removes all common sort indicator icons: ▼▲↑↓⋀⋁
// HTML: <button>Case Reference ▼</button>
// Result: "Case Reference"

const tasks = await utils.parseWorkAllocationTable(table);
expect(Object.keys(tasks[0])[0]).toBe("Case Reference");
expect(Object.keys(tasks[0])[0]).not.toContain("▼");
```

### Empty Headers Get Fallback Names
```ts
// When header button is empty or just whitespace
// HTML: <th><button>  </button></th>

const tasks = await utils.parseWorkAllocationTable(table);

// Empty header becomes "column_1", "column_2", etc.
expect(tasks[0]).toHaveProperty("column_1");
```

### Whitespace Normalization
```ts
// Trims and collapses multiple spaces into single spaces
// HTML: <td>  Multiple   Spaces   Here  </td>
// Result: "Multiple Spaces Here"

const tasks = await utils.parseWorkAllocationTable(table);
expect(tasks[0]["Task"]).toBe("Review application"); // No extra spaces
```

### Practical Examples

**Find tasks assigned to specific user:**
```ts
test("verify tasks assigned to me", async ({ page }) => {
  const utils = new TableUtils();
  
  await page.goto("/work/my-work");
  
  const tasks = await utils.parseWorkAllocationTable(
    page.locator(".work-allocation-table")
  );
  
  const myTasks = tasks.filter(t => t["Assignee"] === "John Doe");
  
  expect(myTasks.length).toBeGreaterThan(0);
  expect(myTasks[0]["Task"]).toBeDefined();
});
```

**Check priority distribution:**
```ts
test("verify high priority tasks", async ({ page }) => {
  const utils = new TableUtils();
  
  const tasks = await utils.parseWorkAllocationTable(
    page.locator("#tasks-table")
  );
  
  const priorities = tasks.reduce((acc, task) => {
    const priority = task["Priority"] || "Unknown";
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("Priority breakdown:", priorities);
  expect(priorities["High"]).toBeGreaterThan(0);
});
```

**Extract case references for bulk operations:**
```ts
test("extract all case references from work queue", async ({ page }) => {
  const utils = new TableUtils();
  
  const tasks = await utils.parseWorkAllocationTable(
    page.locator(".work-table")
  );
  
  const caseRefs = tasks
    .map(t => t["Case Reference"])
    .filter(ref => ref && ref.length === 16);
  
  console.log(`Found ${caseRefs.length} cases in queue`);
  
  // Use for bulk API operations
  for (const caseRef of caseRefs) {
    // await apiClient.get(`/cases/${caseRef}`);
  }
});
```

---

## Error Handling & Troubleshooting

### Common Errors and Solutions

**Error: "Page instance required for string selectors"**
```ts
// ❌ Wrong: string selector without page
await utils.parseKeyValueTable("#table");

// ✅ Correct: provide page parameter
await utils.parseKeyValueTable("#table", page);

// ✅ Or use Locator (no page needed)
await utils.parseKeyValueTable(page.locator("#table"));
```

**Error: "Selector cannot be empty"**
```ts
// ❌ Wrong: empty or whitespace-only selector
await utils.parseDataTable("   ", page);

// ✅ Correct: valid CSS selector
await utils.parseDataTable("#documents-table", page);
```

**Error: "Failed to evaluate table: Target page has been closed"**
```ts
// Page was closed/crashed during evaluation
// Solutions:
// 1. Ensure page is still open
// 2. Add navigation waits before table parsing
// 3. Use page.waitForLoadState() before parsing

await page.goto("/documents");
await page.waitForLoadState("domcontentloaded");
await utils.parseDataTable("#table", page);
```

**Error: "Failed to evaluate table: Execution context was destroyed"**
```ts
// Page navigated away during table parsing
// Solutions:
// 1. Ensure table exists before parsing
// 2. Use waitForSelector to confirm table loaded
// 3. Disable auto-navigation during test

await page.waitForSelector("#documents-table");
const docs = await utils.parseDataTable("#documents-table", page);
```

### Debugging Tips

**Log extracted data structure:**
```ts
const data = await utils.parseDataTable("#table", page);
console.log("Parsed table:", JSON.stringify(data, null, 2));
```

**Verify table HTML before parsing:**
```ts
const tableHtml = await page.locator("#table").innerHTML();
console.log("Table HTML:", tableHtml);
```

**Check for hidden rows:**
```ts
// Count total rows vs visible rows
const totalRows = await page.locator("#table tr").count();
const data = await utils.parseDataTable("#table", page);
console.log(`Total rows: ${totalRows}, Visible rows: ${data.length}`);
```

**Inspect specific cells:**
```ts
const cells = await page.locator("#table tr:first-child td").allTextContents();
console.log("First row cells:", cells);
```

---

## Advanced Patterns

### Comparing Tables Across Pages
```ts
test("verify document list consistency", async ({ page }) => {
  const utils = new TableUtils();
  
  // Extract from page 1
  await page.goto("/case/12345/documents?page=1");
  const page1Docs = await utils.parseDataTable("#docs-table", page);
  
  // Extract from page 2
  await page.goto("/case/12345/documents?page=2");
  const page2Docs = await utils.parseDataTable("#docs-table", page);
  
  // Verify no duplicates
  const allNames = [...page1Docs, ...page2Docs].map(d => d["Document Name"]);
  const uniqueNames = new Set(allNames);
  expect(allNames.length).toBe(uniqueNames.size);
});
```

### Conditional Parsing Based on Table Type
```ts
test("parse any HMCTS table dynamically", async ({ page }) => {
  const utils = new TableUtils();
  const table = page.locator(".case-table");
  
  // Detect table type
  const hasTheadButton = await table.locator("thead button").count() > 0;
  const columnCount = await table.locator("tr:first-child td, tr:first-child th").count();
  
  let data;
  if (hasTheadButton) {
    // Work allocation table
    data = await utils.parseWorkAllocationTable(table);
  } else if (columnCount === 2) {
    // Key-value table
    data = await utils.parseKeyValueTable(table);
  } else {
    // Multi-column data table
    data = await utils.parseDataTable(table);
  }
  
  console.log("Parsed data:", data);
});
```

### Filtering and Transformation Pipeline
```ts
test("complex table data pipeline", async ({ page }) => {
  const utils = new TableUtils();
  
  const docs = await utils.parseDataTable("#documents-table", page);
  
  const processedDocs = docs
    .filter(d => d["Status"] === "Verified")
    .filter(d => d["Document Type"] === "Evidence")
    .map(d => ({
      name: d["Document Name"],
      date: new Date(d["Upload Date"]),
      uploadedBy: d["Uploaded By"]
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  
  expect(processedDocs).toHaveLength(3);
  expect(processedDocs[0].date.getTime()).toBeGreaterThan(
    processedDocs[1].date.getTime()
  );
});
```

### Retrying Table Parsing on Dynamic Content
```ts
import { expect } from "@playwright/test";

test("parse table after dynamic load", async ({ page }) => {
  const utils = new TableUtils();
  
  await page.goto("/case/12345/documents");
  
  // Wait for table to populate (not just appear)
  await expect(async () => {
    const docs = await utils.parseDataTable("#documents-table", page);
    expect(docs.length).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });
  
  // Now parse with confidence
  const docs = await utils.parseDataTable("#documents-table", page);
  expect(docs[0]["Document Name"]).toBeTruthy();
});
```

---

## Legacy Methods

### `mapExuiTable` – EXUI Table Mapper

**Use for legacy EXUI-style tables.** Returns 2D array (rows × columns).

```ts
const rows = await utils.mapExuiTable(page.locator("#exui-table"));

// Result: string[][]
expect(rows[0]).toEqual(["Header1", "Header2", "Header3"]);
expect(rows[1]).toEqual(["Value1", "Value2", "Value3"]);

// Sort icons removed from headers
expect(rows[0][0]).not.toContain("▼");
```

### `mapCitizenTable` – Citizen UI Table Mapper

**Use for Citizen UI tables.** Returns 2D array.

```ts
const rows = await utils.mapCitizenTable(page.locator(".citizen-table"));

// Result: string[][]
const headers = rows[0];
const firstDataRow = rows[1];
```

⚠️ **Migration Recommendation:** For new tests, prefer `parseDataTable` which returns structured objects instead of 2D arrays.

---

## Best Practices

### ✅ Do

1. **Use Locators when possible** (no Page parameter needed):
   ```ts
   const data = await utils.parseDataTable(page.locator("#table"));
   ```

2. **Wait for table to be visible** before parsing:
   ```ts
   await page.waitForSelector("#documents-table");
   const docs = await utils.parseDataTable("#documents-table", page);
   ```

3. **Handle empty tables gracefully**:
   ```ts
   const docs = await utils.parseDataTable("#table", page);
   if (docs.length === 0) {
     console.log("No documents found");
   }
   ```

4. **Log parsed data during development**:
   ```ts
   const data = await utils.parseDataTable("#table", page);
   console.log(JSON.stringify(data, null, 2));
   ```

5. **Use TypeScript for type safety**:
   ```ts
   interface Document {
     "Document Name": string;
     "Upload Date": string;
     "Status": string;
   }
   
   const docs = await utils.parseDataTable("#docs", page) as Document[];
   ```

### ❌ Don't

1. **Don't parse tables during navigation**:
   ```ts
   // ❌ Wrong: race condition
   await page.click('text="Documents"');
   const docs = await utils.parseDataTable("#table", page); // May fail
   
   // ✅ Correct: wait for stability
   await page.click('text="Documents"');
   await page.waitForLoadState("networkidle");
   const docs = await utils.parseDataTable("#table", page);
   ```

2. **Don't use parseWorkAllocationTable with string selectors**:
   ```ts
   // ❌ Wrong: only accepts Locator
   await utils.parseWorkAllocationTable("#work-table");
   
   // ✅ Correct: use Locator
   await utils.parseWorkAllocationTable(page.locator("#work-table"));
   ```

3. **Don't assume column names** – always check dynamically:
   ```ts
   const data = await utils.parseDataTable("#table", page);
   if (data.length > 0) {
     const columns = Object.keys(data[0]);
     console.log("Available columns:", columns);
   }
   ```

4. **Don't ignore errors** – wrap in try/catch for robustness:
   ```ts
   try {
     const data = await utils.parseDataTable("#table", page);
   } catch (error) {
     console.error("Failed to parse table:", error);
     throw error;
   }
   ```

---

## Performance Considerations

- **parseKeyValueTable**: Fast, processes rows sequentially in browser context
- **parseDataTable**: Fast, single browser evaluation with atomic DOM access
- **parseWorkAllocationTable**: Fast, single browser evaluation with atomic DOM access
- All methods execute in browser context – no multiple round-trips

**For large tables (100+ rows):**
```ts
// Measure parsing time
const start = Date.now();
const data = await utils.parseDataTable("#large-table", page);
console.log(`Parsed ${data.length} rows in ${Date.now() - start}ms`);
```

Typical performance: **< 100ms for tables with < 50 rows**

---

## Summary

| Need | Use Method | Key Feature |
|------|-----------|-------------|
| CCD case details | `parseKeyValueTable` | Returns `Record<string, string>` (key → value) |
| Document lists | `parseDataTable` | Returns `Array<Record<string, string>>` (rows) |
| Work allocation | `parseWorkAllocationTable` | Handles buttons/links, comprehensive hidden row filtering |
| Legacy EXUI tables | `mapExuiTable` | Returns `string[][]` |
| Legacy Citizen tables | `mapCitizenTable` | Returns `string[][]` |

**All methods automatically handle:**
- ✅ Hidden row filtering (display:none, visibility:hidden, aria-hidden, hidden attribute)
- ✅ Sort icon removal (▼▲↑↓⋀⋁)
- ✅ Whitespace normalization (trim + collapse multiple spaces)
- ✅ Empty value cells (return empty string)
- ✅ Empty key cells (rows skipped)
- ✅ Detailed error messages

For questions or issues, see [CONTRIBUTING.md](CONTRIBUTING.md) or raise an issue on GitHub.

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
