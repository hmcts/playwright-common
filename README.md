# playwright-common

This repository is a shared playwright package for use within HMCTS. The below list is available from this package:

- **Shared Page Objects & Components**: Page objects and components commonly used across multiple HMCTS teams or services. This excludes those created and used exclusively within a single team or service.
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

### Mandatory Requirements
This library is configuration-driven meaning it relies on environment variables or other configuration that must be defined in the consuming test project as this config could be specific to a service or you may be using different environments. You'll need to set up any necessary config such as env vars in your own test project. 

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
#### CaseUtils Requirements
To use the `CaseUtils` class, you must configure the following environment variables in your repository:

- `S2S_URL`  

**For AAT environment:**
```env
S2S_URL = http://rpe-service-auth-provider-aat.service.core-compute-aat.internal/testing-support/lease 
```
**For DEMO environment:**
```env
S2S_URL = http://rpe-service-auth-provider-demo.service.core-compute-demo.internal/testing-support/lease
```

### Testing Changes

See [Contribution Guide](./CONTRIBUTING.md) for more info regarding testing changes & creating new release.
