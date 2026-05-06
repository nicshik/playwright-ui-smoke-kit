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
