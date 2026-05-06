# Releasing

This package is published through npm Trusted Publishing from GitHub Actions. The repository does not require an `NPM_TOKEN` secret.

## One-Time npm Setup

Trusted Publishing is configured in the npm package settings. If the package does not exist on npm yet, do the first publish manually from your local machine, then enable Trusted Publishing for all later releases.

Open the npm package settings, then add a trusted publisher with these values:

```text
Provider: GitHub Actions
Organization or user: nicshik
Repository: playwright-ui-smoke-kit
Workflow file: release.yml
```

The workflow path in this repository is `.github/workflows/release.yml`. The package `repository.url` field must continue to resolve to `nicshik/playwright-ui-smoke-kit`.

Trusted Publishing requires a GitHub-hosted runner, `id-token: write`, npm `11.5.1` or newer, and Node.js `22.14.0` or newer. The release workflow uses Node.js 24 and upgrades npm before publishing.

You can also configure the trusted publisher from the npm CLI after the package exists:

```bash
npm install -g npm@^11.10.0
npm trust github playwright-ui-smoke-kit --repo nicshik/playwright-ui-smoke-kit --file release.yml
npm trust list playwright-ui-smoke-kit
```

## First Publish Bootstrap

If `https://www.npmjs.com/package/playwright-ui-smoke-kit` does not exist yet, publish the first version locally from a logged-in npm account:

```bash
npm login
npm ci
npm run typecheck
npm test
npm run validate:skills
npm publish --dry-run
npm publish --access public
```

Then configure Trusted Publishing in the npm package settings. After that, future versions should be published only through GitHub Releases.

The release workflow checks whether the package version already exists on npm. If the first version was published manually, creating the matching GitHub Release will not fail on duplicate publish; it will skip `npm publish`.

## Publish the First Version

1. Confirm `package.json` and `CHANGELOG.md` describe the version to publish.
2. Confirm CI is green on `main`.
3. Create a GitHub Release:

```bash
gh release create v0.1.0 \
  --repo nicshik/playwright-ui-smoke-kit \
  --target main \
  --title "v0.1.0" \
  --notes "Initial public release."
```

The release workflow runs typecheck, unit tests, skill validation, checks whether the version is already on npm, and then runs `npm publish --dry-run` plus `npm publish --access public` only for unpublished versions.

## Publish Future Versions

After Trusted Publishing is configured, do not run `npm publish` manually for routine releases. Let GitHub Actions publish from a GitHub Release.

For a patch release:

```bash
git switch main
git pull --ff-only origin main
npm version patch
git push origin main --follow-tags
gh release create "$(node -p "'v' + require('./package.json').version")" \
  --repo nicshik/playwright-ui-smoke-kit \
  --target main \
  --title "$(node -p "'v' + require('./package.json').version")" \
  --notes "Release $(node -p "'v' + require('./package.json').version")"
```

Use `npm version minor` or `npm version major` instead of `npm version patch` when the release type requires it.

The GitHub Release triggers `.github/workflows/release.yml`, which validates the package and publishes the new npm version through Trusted Publishing. No `NPM_TOKEN` is needed.

## Verify

After the workflow succeeds:

```bash
npm view playwright-ui-smoke-kit version
npx playwright-ui-smoke-kit init --help
```

For a clean static-site check:

```bash
mkdir -p /tmp/pw-smoke-check && cd /tmp/pw-smoke-check
npm init -y
printf '<h1>Home</h1>\n' > index.html
npx playwright-ui-smoke-kit init --yes --template static-site --route "/::Home"
npm run smoke:web-ui
```

## Troubleshooting

- `ENEEDAUTH`: check that the package exists on npm and the trusted publisher values match exactly.
- Missing provenance: Trusted Publishing automatically creates provenance for public packages from public repositories.
- Package not found after release: confirm the release workflow completed successfully and published the expected version.
