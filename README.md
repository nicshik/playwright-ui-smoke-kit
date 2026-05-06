# playwright-ui-smoke-kit

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

## CLI Options

```text
--app-dir <dir>              directory with package.json
--template <name>            vite-app | next-app | app-plus-api | static-site
--package-manager <name>     npm | pnpm | yarn | bun
--web-command <command>      command that starts the web app
--web-port <port>            web app port
--api-command <command>      optional API command
--api-url <url>              optional API health URL
--route <route>              repeatable /path::Visible marker route
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

## Russian Quick Start

Русская инструкция: [docs/ru/quickstart.md](docs/ru/quickstart.md).

## License

MIT
