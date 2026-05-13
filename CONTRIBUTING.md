# Contributing

We encourage everyone to contribute to this package; your contributions are invaluable in making this repository a great resource for all. We all have the responsibility of improving the standard in our testing frameworks and helping to share best practice.

## Setting Up the Project

1. Install dependencies: `yarn install`
2. Check linting: `yarn lint`

## Raising a PR

### Linting

This project uses ESLint. Run `yarn lint` before raising a PR (the pipeline will also run these checks).

### Testing changes & installing package locally

After you've made your changes, ensure your changes are tested. See the below process for locally installing this package:

1. Use the `yarn build:package` script to compile your TypeScript code and create a new `package.tgz` file.
2. In your consuming project install the package:
   - `yarn add ~/path-to-package/playwright-common/package.tgz`
3. Your changes should now be available from the local package.

### Documentation (Changelog)

If you are making a change in this repo, you will typically need to update the changelog. This repo follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). In essence:

- Make sure your change is in the relevant section (Added, Changed, Removed etc).
- Ensure your changelog entry is specific and descriptive.
- If you are releasing a new version, ensure the changelog is updated for that version. If not, put your changes into the "unreleased" section.
- If you are releasing a new version, link the changelog in the GitHub release.

Remember that this is a shared package; try to avoid breaking changes. If they are unavoidable make sure the change is fully documented including how to fix what may now be broken.

### Submit a PR for review

Raise a PR to `master` from your branch; CODEOWNERS will be notified when the PR is created. You can also link your PR in Slack channels for visibility.

Some things to consider:
- Ensure your PR accurately describes what it is addressing in the title and description.
- If you are addressing an active issue, link the issue.
- Ensure your commits are squashed when merging.

## Creating a pre-release

In some cases such as SRTs, you may want to publish a version of this package which is not yet the final version.

### How pre-releases are triggered

Pre-releases are published when you **push a git tag** matching:

- `prerelease-*`

The GitHub Actions workflow publishes the package to npm using **Trusted Publishing (OIDC)** and sets the npm dist-tag to `prerelease`.

### Versioning convention

The pre-release will use whatever version is set in your `package.json`. We recommend the following naming convention:


```bash
{PACKAGE_VERSION}-{JIRA-REF-TICKET-TITLE}-rc.{RELEASE CANDIDATE NUMBER} e.g: 1.0.41-EXUI-3513-Manage-Cases-SRT-rc.0
```

Important:
- You cannot publish the same version twice to npm.
- If you need another candidate, bump the RC number (e.g. `rc.1`, `rc.2`, etc).

### Steps

1. Update the version in `package.json` to the desired `-rc.N` pre-release version.
2. Commit and push your changes.
3. Trigger the pre-release publish by creating and pushing a prerelease tag.

#### Using the Yarn scripts

This repo includes the following scripts:

- `prerelease:tag`: creates a prerelease tag for the current commit
- `prerelease:push`: pushes tags to origin
- `prerelease`: runs both

Run:

```bash
yarn prerelease
```

These map to:

```bash		
git tag -a prerelease-$(git rev-parse --short HEAD) -m "prerelease"
git push origin --tags
```

## Creating a new release
Use the following steps to create a new release of this package:

1. Bump the package version in package.json appropriately (Major, Minor & Patch versions): https://semver.org/
2. Update the changelog as needed (see "Documentation (Changelog)" above).
3. Go to the releases page and select "Draft a new release" (or go here): https://github.com/hmcts/playwright-common/releases/new
4. From the "Choose a tag" dropdown, create a new tag based on the version you have just bumped with a v prefix (e.g. v1.2.3).
5. Click "Generate release notes" and add a link in the description to the changelog for this new version.
6. Click "Publish release" and ensure the publish workflow completes successfully.

## Creating an issue
You can also contribute by raising an issue, this can be something you would like to see examples of or things you would like to change/remove/add. There are several tags (enhancement, documentation, bug etc) so please choose the most appropriate.

## Support
Reach out in the #testing_centre_of_excellence or #playwright-community channels should you need any help with contributing to this repo.
