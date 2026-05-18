---
name: playwright_ui_smoke_setup
description: Add or maintain Playwright Chromium UI smoke checks in JavaScript/TypeScript web projects, including Playwright config, route-smoke tests, GitHub Actions workflows, and npm/pnpm/yarn/bun commands.
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# Playwright UI Smoke Setup

## Preferred Path

Use the public CLI whenever possible:

```bash
npx playwright-ui-smoke-kit init
```

For monorepos:

```bash
npx playwright-ui-smoke-kit init --repo-root . --app-dir apps/web
```

If the app depends on shared frontend packages, add them to the generated workflow:

```bash
npx playwright-ui-smoke-kit init \
  --repo-root . \
  --app-dir apps/web \
  --workflow-path "packages/ui/**"
```

When the project shape is clear, use non-interactive flags:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --template vite-app \
  --web-command "npm run dev -- --host 127.0.0.1" \
  --web-port 5173 \
  --route "/::Home"
```

## Workflow

1. Inspect `package.json`, lock files, and existing scripts.
2. Detect `npm`, `pnpm`, `yarn`, or `bun`.
3. Choose `vite-app`, `next-app`, `app-plus-api`, or `static-site`.
4. Select stable, non-mutating routes and visible markers.
5. Avoid overwriting existing Playwright files unless the user explicitly requests replacement.
6. Keep GitHub Actions cost-aware: base-branch triggers, concurrency cancellation, short timeouts, and generated path filters.
7. Use `--workflow-all-changes` only when the project needs browser smoke on every file change.
8. Do not make a path-filtered browser workflow the only required branch-protection check.
9. Use `npx playwright-ui-smoke-kit doctor` to check an existing setup.
10. Use `npx playwright-ui-smoke-kit add-route "/dashboard::Dashboard"` for later route additions.
11. Run the generated `smoke:web-ui` script.

## Manual Fallback

If the CLI is unavailable, manually add:

```text
playwright.config.ts
tests/ui-smoke.spec.ts
.github/workflows/playwright-ui-smoke.yml
```

Install Playwright locally and add:

```json
{
  "scripts": {
    "smoke:web-ui": "playwright test"
  }
}
```

The smoke test should open routes, assert visible text markers, collect `console.error` and `pageerror`, and avoid mutating application state.

## OpenClaw Installation

Install this skill as a shared local OpenClaw skill:

```bash
npx playwright-ui-smoke-kit install-skill openclaw
```

Manual install:

```bash
mkdir -p ~/.openclaw/skills
cp -R skills/openclaw/playwright_ui_smoke_setup ~/.openclaw/skills/
openclaw gateway restart
openclaw skills list
openclaw skills check playwright_ui_smoke_setup
```

Workspace-local installs can use `skills/playwright_ui_smoke_setup/` or `.agents/skills/playwright_ui_smoke_setup/`.
