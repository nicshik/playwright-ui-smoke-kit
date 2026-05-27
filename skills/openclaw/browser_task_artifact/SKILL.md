---
name: browser_task_artifact
description: Turn a repeatable browser or web task into a verified reusable artifact with task notes, critical points, a final script, logs, screenshots, structured results, and verification evidence.
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# Browser Task Artifact

## Purpose

Use this skill when a browser task needs durable proof: a checked workflow, a
reusable script, evidence screenshots, action logs, or structured results. This
is different from baseline route smoke. The browser is disposable; the artifact
workspace is the state.

Use `playwright_ui_smoke_setup` instead when the user only wants Chromium route
smoke tests, `playwright.config.ts`, GitHub Actions wiring, or route marker
maintenance.

## Output Contract

Create one workspace under `.tmp/browser-task-artifacts/<task-id>/` unless the
user or repository policy names another location.

Prefer the package CLI:

```bash
npx playwright-ui-smoke-kit artifact-init \
  --task-id <task-id> \
  --title "<human-readable title>" \
  --source "<url-or-local-route>" \
  --script-ext ts
```

Before treating the workspace as proof, run:

```bash
npx playwright-ui-smoke-kit artifact-check .tmp/browser-task-artifacts/<task-id>
npx playwright-ui-smoke-kit artifact-check .tmp/browser-task-artifacts/<task-id> --strict
```

The workspace should contain:

- `task.md` with the original task, sources, assumptions, and secret-handling notes.
- `plan.md` with critical points that must be proven.
- `final_runs/run_<n>/final_script.*` with the clean reusable script.
- `final_runs/run_<n>/action_log.md` or `action_log.jsonl`.
- `final_runs/run_<n>/result.json` with structured output.
- `final_runs/run_<n>/screenshots/` with evidence screenshots.
- `verification.md` mapping each critical point to concrete evidence.

## Workflow

1. Read the target UI or site from current evidence; do not rely on memory.
2. Fill `task.md` and `plan.md` before coding.
3. Explore with scratch code inside the artifact workspace.
4. Create or replace `final_runs/run_<n>/final_script.*`.
5. Run the final script from a clean start, preferably through:

```bash
npx playwright-ui-smoke-kit artifact-run .tmp/browser-task-artifacts/<task-id> -- [args...]
```

6. Save action logs, screenshots, and `result.json` in the selected run directory.
7. Update `verification.md` so every critical point cites concrete evidence.
8. Run `artifact-check --strict` before reporting the artifact as verified.

## Reuse Rules

When the task has variable inputs, parameterize the final script with CLI flags.
The script should have safe defaults that reproduce the original task, avoid
side effects at import time, and show `--help` when reuse matters.

## Safety

- Ask before running workflows that mutate external state, submit forms, make payments, send messages, or post publicly.
- Never store secrets, bearer values, private keys, auth headers, full `.env` contents, or private customer data in committed artifacts.
- Commit only sanitized summaries or deterministic example artifacts.
- Promote an artifact into CI only after it is deterministic, safe, and fast.
