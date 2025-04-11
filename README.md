TESTING

# playwright-common

This repository is a shared playwright package for use within HMCTS. The below list is available from this package:

- **Page Objects & Components**: Common page objects and components used within HMCTS that are not unique.
- **Configuration**: Configuration for playwright: common config, project config & linting
- **Utilities**: Commonly used logic for interacting with HMCTS pages, API's or playwright.

## Contributing

We all share the responsibility of ensuring this repo is up to date and accurate in terms of best practice. If you would like to contribute you can raise a github issue with the improvement you are suggesting or raise a PR yourself. See the [contribution guide](https://github.com/hmcts/tcoe-playwright-example/blob/master/CONTRIBUTING.md) for more info.

TCoE Best Practices for setting up playwright in your service can be found in the [playwright-e2e/readme.md](https://github.com/hmcts/tcoe-playwright-example/blob/master/docs/BEST_PRACTICE.md).

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- Node.js (v18+)
- Yarn

### Installation

Clone the repository and install the dependencies:

```bash
git clone git@github.com:hmcts/playwright-common.git
cd playwright-common
yarn install
yarn setup
```

### Testing Changes

See [Contribution Guide](./CONTRIBUTING.md) for more info regarding testing changes & creating new release.
