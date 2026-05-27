# Browser Task Artifacts

Use browser task artifacts when a route smoke test is too small for the job. An artifact is a durable proof workspace: task notes, critical points, a reusable final script, logs, screenshots, a structured result, and a verification file.

Artifacts are useful when "the browser looked right" is not enough. They leave a repeatable script and evidence that another maintainer or agent can inspect later.

Use this mode for:

- multi-step UI proof before a release;
- visual QA evidence for a viewport or state;
- task-specific web extraction or form-fill automation;
- workflows that may later become Playwright e2e or smoke tests.

Do not use this mode as the first layer of browser coverage. Route smoke should stay small and fast; artifacts are heavier and should be created only when the evidence has value.

## Lifecycle

Create a workspace:

```bash
npx playwright-ui-smoke-kit artifact-init \
  --task-id customer-new-task-proof \
  --title "Customer new task proof" \
  --source "http://127.0.0.1:5173/customer/new-task"
```

Fill `task.md` and `plan.md`, then replace `final_runs/run_001/final_script.*` with a real script. The final script owns the task-specific work: browser launch, navigation, screenshots, action logging, and updates to `result.json`.

The generated files have different jobs:

- `task.md`: original request, source URLs or routes, assumptions, and secret-handling notes.
- `plan.md`: critical points that must be proven.
- `final_script.*`: the clean reusable script for the selected run.
- `action_log.md` or `action_log.jsonl`: task-relevant actions and observations.
- `result.json`: machine-readable status, parameters, evidence references, and final result.
- `screenshots/`: visual evidence for critical points.
- `verification.md`: the checklist that maps every critical point to concrete evidence.

Run the final script from its run directory:

```bash
npx playwright-ui-smoke-kit artifact-run .tmp/browser-task-artifacts/customer-new-task-proof -- --user customer-a
```

Check the artifact:

```bash
npx playwright-ui-smoke-kit artifact-check .tmp/browser-task-artifacts/customer-new-task-proof
npx playwright-ui-smoke-kit artifact-check .tmp/browser-task-artifacts/customer-new-task-proof --strict
```

## `artifact-run`

`artifact-run` finds a run directory and executes exactly one `final_script.ts`, `final_script.js`, or `final_script.py`.

```bash
npx playwright-ui-smoke-kit artifact-run <artifact-dir> [--run run_001] [--script final_script.js] [--dry-run] -- [args...]
```

- Default run: latest `final_runs/run_*`.
- Default script: the only `final_script.ts|js|py` in the selected run.
- `.js`: runs with `node`.
- `.ts`: runs with bundled `tsx`.
- `.py`: runs with `python3`.
- Extra arguments after `--` are passed to the final script.
- `--dry-run` prints the resolved command without executing it.

If a run contains multiple final scripts, pass `--script` so the command is unambiguous.

## Strict Mode

`artifact-check --strict` is the proof gate. It requires:

- `result.json.status` is `verified`;
- `result.json.command` is not `TODO`;
- `critical_points` and `evidence_refs` are non-empty arrays;
- `result` is not `null`;
- at least one file exists under `screenshots/`;
- `verification.md` has no `TODO` or `pending` markers.

Common failures:

- the final script ran but did not update `result.json`;
- screenshots were written outside the latest run directory;
- `verification.md` still has draft markers;
- both `final_script.ts` and `final_script.js` exist and `artifact-run` needs `--script`.

## Promotion to CI

An artifact can be promoted into a permanent Playwright test only after it is:

- deterministic across clean runs;
- safe to run without mutating external state;
- fast enough for the intended CI layer;
- valuable as a regression guard rather than only as one-time evidence.

Until then, keep it as an artifact workspace and commit only sanitized examples or summaries.

## Example

This repository ships a strict verified example:

```bash
npx playwright-ui-smoke-kit artifact-check examples/browser-task-artifacts/static-page-proof --strict
npx playwright-ui-smoke-kit artifact-run examples/browser-task-artifacts/static-page-proof --dry-run
```

Use it as a reference for the expected shape, not as a browser coverage substitute. Route smoke tests should stay small; artifacts are for repeatable task proof.
