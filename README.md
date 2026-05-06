# playwright-ui-smoke-kit

[![CI](https://github.com/nicshik/playwright-ui-smoke-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/nicshik/playwright-ui-smoke-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/playwright-ui-smoke-kit.svg)](https://www.npmjs.com/package/playwright-ui-smoke-kit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

Install a small, boring Playwright UI smoke check in a web project.

The kit creates a Chromium-only route smoke test, a Playwright config, a GitHub Actions workflow, and a `smoke:web-ui` package script. It is meant to be the first browser check you add to a project: fast enough for every pull request, simple enough to debug, and explicit enough to copy between teams.

## Quick Start

```bash
npx playwright-ui-smoke-kit init
```

For non-interactive setup:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --template vite-app \
  --web-command "npm run dev -- --host 127.0.0.1" \
  --web-port 5173 \
  --route "/::Home"
```

Then run:

```bash
npm run smoke:web-ui
```

Use the matching command for your package manager:

```bash
pnpm run smoke:web-ui
yarn smoke:web-ui
bun run smoke:web-ui
```

## What It Generates

```text
playwright.config.ts
tests/ui-smoke.spec.ts
.github/workflows/playwright-ui-smoke.yml
```

It also adds this script:

```json
{
  "scripts": {
    "smoke:web-ui": "playwright test"
  }
}
```

## Before / After

Before:

```text
package.json
```

After:

```text
package.json
playwright.config.ts
tests/ui-smoke.spec.ts
tests/static-server.mjs        # static-site only
.github/workflows/playwright-ui-smoke.yml
```

## Templates

- `vite-app`
- `next-app`
- `app-plus-api`
- `static-site`

Every template can be overridden with flags. Routes use the format:

```bash
--route "/dashboard::Dashboard"
--route "/settings::Settings"
```

The generated test opens each route, waits for the visible marker, and fails on `console.error` or uncaught page errors. It does not click buttons or mutate application state.

## Monorepo Usage

Use `--repo-root` for the repository root and `--app-dir` for the app package:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --repo-root . \
  --app-dir apps/web \
  --template vite-app \
  --route "/::Home"
```

This writes the GitHub Actions workflow to the root `.github/workflows` directory and sets `working-directory: apps/web`.

## Maintenance Commands

Check an existing setup:

```bash
npx playwright-ui-smoke-kit doctor
```

Add a new route marker:

```bash
npx playwright-ui-smoke-kit add-route "/dashboard::Dashboard"
```

Install bundled agent skills:

```bash
npx playwright-ui-smoke-kit install-skill codex
npx playwright-ui-smoke-kit install-skill openclaw
```

## CLI Options

```text
--repo-root <dir>             repository root for .github/workflows
--app-dir <dir>              directory with package.json
--template <name>            vite-app | next-app | app-plus-api | static-site
--package-manager <name>     npm | pnpm | yarn | bun
--web-command <command>      command that starts the web app
--web-port <port>            web app port
--api-command <command>      optional API command
--api-url <url>              optional API health URL
--route <route>              repeatable /path::Visible marker route
--script-name <name>         package.json script name
--test-dir <dir>             directory for generated smoke tests
--workflow-name <name>       GitHub Actions workflow file name
--web-env <entry>            repeatable web server env as KEY=value
--api-env <entry>            repeatable API server env as KEY=value
--ci <provider>              github | none
--dry-run                    print planned changes without writing files
--force                      overwrite generated files
--yes                        accept defaults
--skip-install               do not install @playwright/test
```

## Skills

The repository includes installable agent skills:

- Codex: `skills/codex/playwright-smoke-setup`
- OpenClaw: `skills/openclaw/playwright_ui_smoke_setup`

See [docs/skills.md](docs/skills.md).

## Troubleshooting

- **Port is busy**: run `npx playwright-ui-smoke-kit doctor` and either stop the external process or choose another `--web-port`.
- **Marker is not found**: pick visible text that is rendered without interaction and is stable across environments.
- **`console.error` fails the test**: fix the app error or make the app avoid noisy browser errors during smoke routes.
- **Browser is missing**: run `npx playwright install chromium` locally or `npx playwright install --with-deps chromium` in CI.
- **GitHub Actions cache misses**: check `--repo-root`, `--app-dir`, and the generated `cache-dependency-path`.

## Russian Quick Start

Русская инструкция: [docs/ru/quickstart.md](docs/ru/quickstart.md).

## License

MIT
