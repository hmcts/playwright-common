# Contributing

We encourage everyone to contribute to this package, your contributions are invaluable in making this repository a great resource for all. We all have the responsibility of improving the standard in our testing frameworks and helping to share best practice.

## Setting Up the Project

1. Install dependencies: `yarn install`

2. Check to ensure the linter is working `yarn lint`

## Raising a PR

### Linting

This project uses ESLint, you can run `yarn lint` to run the linting rules on your changes (the pipeline will also run these checks). Ensure linting has been run on any new code before raising a PR.

### Testing changes & installing package locally

After you've made your changes, ensure that your changes are tested. See the below process for locally installing this package:

1. Use the `yarn build:package` script to compile your typescript code and creating a new `package.tgz` file
2. In your consuming project use the following command to install the package `yarn add ~/path-to-package/playwright-common/package.tgz`
3. Your changes should now be available from the local package

### Documentation (Changelog)

If you are making a change in this repo, you will typically need to update the changelog. This repo follows [this](https://keepachangelog.com/en/1.1.0/) guide. In essence:

- Make sure your change is in the relevant section (Added, Changed, Removed etc) (see example above)
- Ensure your changelog entry is specific and actually descriptive of the change you've made
- If you are releasing a new version, ensure the changelog is updated for that version. If not, put your changes into the "unreleased" section
- If you are releasing a new version, link the changelog in the GitHub releases.

Remember that this is a shared package, try to avoid any breaking changes. If they are unavoidable make sure the change is fully documented including how to fix what may now be broken.

### Submit a PR for review

Simply raise a PR to master from your branch, CODEOWNERS will be notified the PR is created. However, you can also link your PR in the slack channels below for visibility. Some things to consider:

- Ensure your PR accurately describes what it is addressing in the title and description.
- If you are addressing an active issue, link the issue.
- Ensure your commits are squashed when merging

### Creating a pre-release

In some cases such as SRT's, you may want to publish a version of this package but which is not yet the final version. For this you can create a "pre-release". Currently, if you have PR targetting master you can add the `create-prerelease` tag to your PR which triggers the GitHub action to publish a pre-release to npm.

This pre-release will use whatever version is set in your `package.json` and this is what may be shared with other teams who require this updated package version. So it is advisable to follow the following naming convention:

```
{PACKAGE_VERSION}-{JIRA-REF}-rc.{RELEASE CANDIDATE NUMBER}
e.g: 1.0.14-EXUI-3513-Manage-Cases-SRT-rc.0
```

The important part is to ensure you use a release candidate number (`rc.0`) as you cannot publish to NPM using the same tag twice. So should you have changes, you can simply bump the RC number. Like with a normal version, this will then be available from NPM.

### Creating a new release

Use the following steps to create a new release of this package:

1. Bump the package version in `package.json` [appropriately](https://semver.org/) - Major, Minor & Patch versions
2. Go to the [releases page](https://github.com/hmcts/playwright-common/releases) and select "Draft a new release" or go [here](https://github.com/hmcts/playwright-common/releases/new)
3. From the "Choose a tag" dropdown, create a new tag based on the version you have just bumped with a `v` prefix
4. Click "Generate release notes" and add a link in the description to the changelog for this new version
5. Finally, click the "Publish release" button and ensure the [GitHub Action](https://github.com/hmcts/playwright-common/actions/workflows/npm_publish.yml) completes successfully

## Creating an issue

You can also contribute by raising an issue, this can be something you would like to see examples of or things you would like to change/remove/add. There are several tags (enhancement, documentation, bug etc) so please choose the most appropriate.

## Support

Reach out in the `#testing_centre_of_excellence` or `#playwright-community` channels should you need any help with contributing to this repo.
