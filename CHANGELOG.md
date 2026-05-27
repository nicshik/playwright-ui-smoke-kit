# Changelog

## Unreleased

- Added `artifact-run` for executing browser task artifact final scripts.
- Added a strict verified browser task artifact example.
- Expanded artifact workflow documentation, README About, and strict mode guidance.
- Added bundled `browser-task-artifact` skills for Codex and OpenClaw.
- Added `install-skill --skill smoke|browser-task-artifact|all`.
- Fixed the CLI version banner to read from `package.json`.

## 0.1.2

- Added `artifact-init` for reusable browser task artifact workspaces.
- Added `artifact-check` with strict proof-readiness checks.
- Exported browser task artifact helpers and types from the package entrypoint.
- Documented the browser task artifact workflow.

## 0.1.1

- Added cost-aware GitHub Actions workflow generation with base-branch triggers, concurrency cancellation, path filters, and a 10 minute default timeout.
- Added `--base-branch`, `--workflow-path`, `--workflow-all-changes`, and `--workflow-timeout`.
- Added `doctor` warnings for expensive workflow shapes.
- Optimized this repository's CI triggers to avoid duplicate branch and pull request runs.

## 0.1.0

- Added `playwright-ui-smoke-kit init`.
- Added Chromium-only Playwright route smoke generation.
- Added GitHub Actions workflow generation.
- Added npm, pnpm, yarn, and bun support.
- Added Codex and OpenClaw skill packs.
- Added `doctor`, `add-route`, and `install-skill` maintenance commands.
- Added monorepo support through `--repo-root` and `--app-dir`.
- Added npm Trusted Publishing release workflow documentation.
