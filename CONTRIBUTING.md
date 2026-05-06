# Contributing

## Development

```bash
npm install
npm run typecheck
npm test
npm run validate:skills
```

Run the fixture smoke test for one package manager:

```bash
PACKAGE_MANAGER=npm npm run test:e2e
```

## Pull Requests

- Keep generated UI smoke tests non-mutating.
- Keep Chromium-only smoke as the first layer.
- Add or update tests for CLI behavior changes.
- Do not commit Playwright reports, browser binaries, or fixture output.

## Releases

Maintainers publish through npm Trusted Publishing from GitHub Actions. Do not add long-lived npm tokens to this repository.

See [docs/releasing.md](docs/releasing.md) for the release checklist and npm trusted publisher settings.
