# Agent Skills

This repository ships installable skills for agents that work with browser
automation in web projects.

## Skills

| Skill | Target | Use for | Do not use for |
|---|---|---|---|
| `playwright-smoke-setup` | Codex | Baseline Chromium route smoke, Playwright config, GitHub Actions workflow, route markers | Repeatable proof tasks with screenshots and logs |
| `browser-task-artifact` | Codex | Verified browser task workspaces, reusable final scripts, evidence screenshots, `result.json`, `verification.md` | Basic route smoke setup |
| `playwright_ui_smoke_setup` | OpenClaw | Same route-smoke workflow for OpenClaw | Browser proof artifacts |
| `browser_task_artifact` | OpenClaw | Same artifact workflow for OpenClaw | Basic route smoke setup |

Route smoke is the fast pull request guard. Browser task artifacts are the
heavier proof/reuse workflow for specific browser tasks.

## Install with CLI

Default installs keep backward compatibility and install the smoke skill:

```bash
npx playwright-ui-smoke-kit install-skill codex
npx playwright-ui-smoke-kit install-skill openclaw
```

Install only the artifact skill:

```bash
npx playwright-ui-smoke-kit install-skill codex --skill browser-task-artifact
npx playwright-ui-smoke-kit install-skill openclaw --skill browser-task-artifact
```

Install both skills for one target:

```bash
npx playwright-ui-smoke-kit install-skill codex --skill all
npx playwright-ui-smoke-kit install-skill openclaw --skill all
```

Use `--dry-run` before copying and `--force` only when replacing an existing
local skill.

## Manual Install

Codex:

```bash
mkdir -p ~/.codex/skills
cp -R skills/codex/playwright-smoke-setup ~/.codex/skills/
cp -R skills/codex/browser-task-artifact ~/.codex/skills/
```

OpenClaw:

```bash
mkdir -p ~/.openclaw/skills
cp -R skills/openclaw/playwright_ui_smoke_setup ~/.openclaw/skills/
cp -R skills/openclaw/browser_task_artifact ~/.openclaw/skills/
```

Reload OpenClaw and verify:

```bash
openclaw skills list
openclaw skills check playwright_ui_smoke_setup
openclaw skills check browser_task_artifact
```

OpenClaw skills can also live in workspace-local `skills/` or `.agents/skills/`
directories. Use a workspace-local install when a project needs a customized
version of the skill.

## Boundary

Use the smoke skill when the requested outcome is a Playwright setup that should
run regularly in CI.

Use the artifact skill when the requested outcome is a repeatable browser task:
visual proof, screenshots, logs, extraction, form-fill automation, or a final
script that may later be reused.

The artifact workflow can produce a candidate for CI, but do not promote it
until it is deterministic, safe, and fast.

## Safety

The smoke skills recommend `npx playwright-ui-smoke-kit init` as the primary
path. They should inspect a project first, choose the closest template, and
avoid overwriting existing test files unless the user explicitly asks for
`--force`.

The artifact skills recommend `artifact-init`, `artifact-run`, and
`artifact-check --strict`. They should keep raw screenshots/logs inside the
artifact workspace and avoid committing secrets, private account data, bearer
tokens, auth headers, or full environment files.
