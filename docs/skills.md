# Agent Skills

This repository ships skills for agents that can install UI smoke checks in projects.

## Codex

Copy the skill directory into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R skills/codex/playwright-smoke-setup ~/.codex/skills/
```

Then start a new Codex session and ask:

```text
Use playwright-smoke-setup to add UI smoke checks to this project.
```

## OpenClaw

Copy the OpenClaw skill pack into a shared OpenClaw skills directory:

```bash
mkdir -p ~/.openclaw/skills
cp -R skills/openclaw/playwright_ui_smoke_setup ~/.openclaw/skills/
```

Reload OpenClaw and verify:

```bash
openclaw skills list
openclaw skills check playwright_ui_smoke_setup
```

OpenClaw skills can also live in workspace-local `skills/` or `.agents/skills/` directories. Use a workspace-local install when a project needs a customized version of the skill.

## Safety

The skills recommend `npx playwright-ui-smoke-kit init` as the primary path. They should inspect a project first, choose the closest template, and avoid overwriting existing test files unless the user explicitly asks for `--force`.
