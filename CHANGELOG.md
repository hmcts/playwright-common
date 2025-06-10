# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.22]: https://github.com/hmcts/playwright-common/compare/v1.0.22...HEAD
[1.0.21]: https://github.com/hmcts/playwright-common/compare/v1.0.21...v1.0.22
[1.0.20]: https://github.com/hmcts/playwright-common/compare/v1.0.20...v1.0.21
[1.0.19]: https://github.com/hmcts/playwright-common/compare/v1.0.19...v1.0.20
[1.0.18]: https://github.com/hmcts/playwright-common/compare/v1.0.18...v1.0.19
[1.0.17]: https://github.com/hmcts/playwright-common/compare/v1.0.17...v1.0.18
[1.0.16]: https://github.com/hmcts/playwright-common/compare/v1.0.16...v1.0.17
[1.0.15]: https://github.com/hmcts/playwright-common/compare/v1.0.15...v1.0.16
[1.0.14]: https://github.com/hmcts/playwright-common/compare/v1.0.14...v1.0.15
[1.0.13]: https://github.com/hmcts/playwright-common/releases/tag/v1.0.13
