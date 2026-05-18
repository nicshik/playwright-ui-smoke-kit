---
name: playwright-smoke-setup
description: Add or maintain Playwright Chromium UI smoke checks in JavaScript/TypeScript web projects. Use when Codex is asked to install Playwright route-smoke tests, generate playwright.config.ts, add GitHub Actions browser checks, or standardize frontend smoke coverage across npm, pnpm, yarn, or bun projects.
---

# Playwright Smoke Setup

## Workflow

1. Inspect the project before changing files:
   - locate `package.json`;
   - detect `npm`, `pnpm`, `yarn`, or `bun` from lock files or `packageManager`;
   - find the web dev command and port from scripts/configs;
   - identify 1-5 stable non-mutating routes and visible text markers.
2. Prefer the CLI:

```bash
npx playwright-ui-smoke-kit init
```

For monorepos, pass both roots:

```bash
npx playwright-ui-smoke-kit init --repo-root . --app-dir apps/web
```

When a monorepo app depends on shared frontend packages, add those globs so the generated workflow still runs when shared UI code changes:

```bash
npx playwright-ui-smoke-kit init \
  --repo-root . \
  --app-dir apps/web \
  --workflow-path "packages/ui/**"
```

Use non-interactive mode when enough project facts are known:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --template vite-app \
  --web-command "npm run dev -- --host 127.0.0.1" \
  --web-port 5173 \
  --route "/::Home"
```

3. Pick the nearest template:
   - `next-app` for Next.js;
   - `app-plus-api` when Playwright should start both API and Web App;
   - `static-site` for static HTML or documentation sites;
   - `vite-app` for Vite, Astro, SvelteKit, Nuxt, and unknown JavaScript web apps unless project evidence suggests another template.
4. Do not use `--force` unless the user explicitly asks to replace existing Playwright files.
5. Keep the generated GitHub Actions workflow cost-aware unless the project explicitly needs broader coverage:
   - leave base-branch triggers and `concurrency` enabled;
   - prefer generated `paths` or `paths-ignore` filters;
   - use `--workflow-all-changes` only when the app depends on broad repository state;
   - do not make a path-filtered browser workflow the only required branch-protection check.
6. Use `doctor` after installation and `add-route` for later route additions:

```bash
npx playwright-ui-smoke-kit doctor
npx playwright-ui-smoke-kit add-route "/dashboard::Dashboard"
```

6. Run the generated check with the project package manager.

## Skill Installation

Install or update this skill with:

```bash
npx playwright-ui-smoke-kit install-skill codex
```

Use `--dry-run` before copying and `--force` only when replacing an existing local skill.

## Manual Fallback

If the CLI cannot be used, create the same surface manually:

```text
playwright.config.ts
tests/ui-smoke.spec.ts
.github/workflows/playwright-ui-smoke.yml
```

Add:

```json
{
  "scripts": {
    "smoke:web-ui": "playwright test"
  }
}
```

Install Playwright locally in the project:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Use equivalent commands for `pnpm`, `yarn`, or `bun`.

## Test Standards

- Keep the first layer Chromium-only.
- Route-smoke tests should open pages and assert visible text markers.
- Collect `console.error` and `pageerror`.
- Avoid clicks, form submits, payments, deletes, and other state mutations.
- Use Playwright `webServer` to start required local processes.
- Use `trace: "retain-on-failure"` and `screenshot: "only-on-failure"`.
- In CI, install browsers with `playwright install --with-deps chromium`.
- In GitHub Actions, avoid duplicate `push` and `pull_request` runs and use `concurrency.cancel-in-progress`.

## Verification

Run at least:

```bash
npm run smoke:web-ui
```

For projects with TypeScript/build checks, run the existing checks too. If long-running servers are started outside Playwright `webServer`, record and stop them according to the repository's local runtime hygiene rules.
