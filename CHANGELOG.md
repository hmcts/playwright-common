# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.41]

- ApiClient hardening: default timeout, richer ApiClientError metadata (correlationId/retryAfter/body preview), fetch error wrapping, Retry-After-aware backoff, redaction fail-closed attachments (raw only when debug is explicit).
- Retry helper now honours `retryAfterMs` on errors when scheduling backoff.
- Added human-friendly recipes (coverage/endpoint scripting, attachment safety, fixture wiring) and a 429-aware retry example.
- prepack builds before publish for safer releases.

## [1.0.40]

- Added coverage utilities to parse `coverage-summary.json`, format human-readable summaries, and provide table-friendly rows.
- Added API endpoint scanner utility to count Playwright API client calls per endpoint with configurable patterns/extensions.
- Hardened `TableUtils` alignment to drop selection/action columns correctly; added unit coverage for table mapping, coverage, and endpoint scanning.

## [1.0.39]

- Updated the table scraping function to allow for checkboxes that might occur on the right hand side of the table.
  
## [1.0.38]

- Updated S2S_SECRET is now optional.

## [1.0.37]

- Added
  - Winston-based logger factory with structured metadata support for Playwright tests.
  - Shared API client helper with sanitised request/response logging and attachment tooling.
  - Vitest coverage for logging, redaction, IdAM, ServiceAuth, and API client utilities.
  - Entry points for the new logging utilities.

- Changed
  - Hardened redaction logic to cope with circular structures, arrays, and nested secrets.
  - Migrated IdAM and ServiceAuth helpers to the shared telemetry/logging pipeline.
  - Documented logging usage and environment toggles; declared missing peer dependencies.
  - Bumped Playwright dependencies to v1.56.1.
  - Fixed minor spelling issues highlighted by linting.
  - Hardened shared wait, validator, browser, session, table and accessibility helpers to improve resiliency, trim logging noise and remove unsafe casts.
  - Tightened service and IDAM client behaviour (token parsing, OAuth payload construction, logger propagation) plus readonly configuration exports.
  - Improved CLI scripts (`delete-nightly-dev-branch`, `get-secrets`) with stronger validation and clearer error handling.

## [1.0.36]

- Added delete nightly branch script which can be run via yarn cli command.
- Updated get secrets script to be run directly via yarn cli command
  - **THIS IS A BREAKING CHANGE** - teams using the previous method will need to replace it with this new command.

## [1.0.35]

- Updated get secrets script to allow for an array of keyvault names to be specified.

## [1.0.34]

- Added: generateReport method in AxeUtils to create a consolidated HTML accessibility report across multiple pages.
  - Report is attached to Playwright test artifacts.
  - Results are grouped per page in expandable sections, highlighting failures.
  - Report resets after each test run for fresh results.

## [1.0.33]

- Added update user method to idam utils

## [1.0.32]

- Removed playwright and playwright-core packages as they are not needed and were causing duplication issues

## [1.0.31]

- Fixed the publish release workflow to ensure `latest` tag is applied to newest versions

## [1.0.30]

- Added "user.id" in the CreateUserParams in IdamUtils
- Move service token retrieval to service-auth.utils.ts

## [1.0.29]

- Added method to IdamUtils - get userInfo to allow GET requests based on userId or email

## [1.0.28]

- Added method to IdamUtils - can be used to retrieve service auth token. UPDATE: to use IdamUtils class, you need to set up THREE env variables in your repo:
  - `IDAM_WEB_URL`
  - `IDAM_TESTING_SUPPORT_URL`
  - `IDAM_S2S_URL`
    (see README.md for more details)

## [1.0.27]

- Fix: moved `@playwright/test` to `peerDependencies` & `devDependencies` to prevent multiple versions being loaded at runtime.

## [1.0.26]

- Added: LocaleUtils added to help with localisation testing

## [1.0.25]

- Change: session file is now optional for idam.po.ts

## [1.0.24]

- Allow passing path of .env and .env.example files in get secrets script

## [1.0.23]

- Added: IdamUtils which can be used by teams to create users
  - to use IdamUtils class, you need to set up two env variables in your repo: `IDAM_WEB_URL` and `IDAM_TESTING_SUPPORT_URL` (see README.md for more details)

## [1.0.22]

- Fix: allow ConfigUtils to be imported

## [1.0.21]

- Added: ConfigUtils class with "getEnvVar" which can be used to ensure environment variables are present prior to test execution.

## [1.0.20]

- Move devDeps to dependencies due to missing modules

## [1.0.19]

- Axe Core Fix: Array not supported in `.exclude()` so chain the method instead

## [1.0.18]

- Add comment to secrets script
- Add logging to the Axe Core implementation

## [1.0.17]

- Add script to populate secrets via azure key vault

## [1.0.16]

- Fix table utils (in cases where EXUI doesn't use checkboxes)

## [1.0.15]

- Workflow changes - creating a pre-release version
- Remove base page

## [1.0.14]

### Added

- Documentation - README, CONTRIBUTING & CHANGELOG
- Add `chromium` project config

## [1.0.13]

### Added

- Added table & wait utilities

[1.0.40]: https://github.com/hmcts/playwright-common/compare/v1.0.40...HEAD
[1.0.39]: https://github.com/hmcts/playwright-common/compare/v1.0.39...v1.0.40
[1.0.38]: https://github.com/hmcts/playwright-common/compare/v1.0.38...v1.0.39
[1.0.37]: https://github.com/hmcts/playwright-common/compare/v1.0.37...v1.0.38
[1.0.36]: https://github.com/hmcts/playwright-common/compare/v1.0.36...v1.0.37
[1.0.35]: https://github.com/hmcts/playwright-common/compare/v1.0.35...v1.0.36
[1.0.34]: https://github.com/hmcts/playwright-common/compare/v1.0.34...v1.0.35
[1.0.33]: https://github.com/hmcts/playwright-common/compare/v1.0.33...v1.0.34
[1.0.32]: https://github.com/hmcts/playwright-common/compare/v1.0.32...v1.0.33
[1.0.31]: https://github.com/hmcts/playwright-common/compare/v1.0.31...v1.0.32
[1.0.30]: https://github.com/hmcts/playwright-common/compare/v1.0.30...v1.0.31
[1.0.29]: https://github.com/hmcts/playwright-common/compare/v1.0.29...v1.0.30
[1.0.28]: https://github.com/hmcts/playwright-common/compare/v1.0.28...v1.0.29
[1.0.27]: https://github.com/hmcts/playwright-common/compare/v1.0.27...v1.0.28
[1.0.26]: https://github.com/hmcts/playwright-common/compare/v1.0.26...v1.0.27
[1.0.25]: https://github.com/hmcts/playwright-common/compare/v1.0.25...v1.0.26
[1.0.24]: https://github.com/hmcts/playwright-common/compare/v1.0.24...v1.0.25
[1.0.23]: https://github.com/hmcts/playwright-common/compare/v1.0.23...v1.0.24
[1.0.22]: https://github.com/hmcts/playwright-common/compare/v1.0.22...v1.0.23
[1.0.21]: https://github.com/hmcts/playwright-common/compare/v1.0.21...v1.0.22
[1.0.20]: https://github.com/hmcts/playwright-common/compare/v1.0.20...v1.0.21
[1.0.19]: https://github.com/hmcts/playwright-common/compare/v1.0.19...v1.0.20
[1.0.18]: https://github.com/hmcts/playwright-common/compare/v1.0.18...v1.0.19
[1.0.17]: https://github.com/hmcts/playwright-common/compare/v1.0.17...v1.0.18
[1.0.16]: https://github.com/hmcts/playwright-common/compare/v1.0.16...v1.0.17
[1.0.15]: https://github.com/hmcts/playwright-common/compare/v1.0.15...v1.0.16
[1.0.14]: https://github.com/hmcts/playwright-common/compare/v1.0.14...v1.0.15
[1.0.13]: https://github.com/hmcts/playwright-common/releases/tag/v1.0.13
