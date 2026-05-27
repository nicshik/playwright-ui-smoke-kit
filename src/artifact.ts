import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export type ArtifactScriptExt = "ts" | "js" | "py";
export type ArtifactCheckStatus = "pass" | "warn" | "fail";

export interface ArtifactInitOptions {
  outDir?: string;
  taskId: string;
  title?: string;
  source?: string;
  scriptExt?: ArtifactScriptExt;
}

export interface ArtifactInitResult {
  workspaceDir: string;
  runDir: string;
  files: string[];
}

export interface ArtifactCheck {
  name: string;
  status: ArtifactCheckStatus;
  message: string;
}

export interface ArtifactCheckResult {
  artifactDir: string;
  latestRunDir?: string;
  checks: ArtifactCheck[];
}

export interface ArtifactRunOptions {
  artifactDir: string;
  runId?: string;
  script?: string;
  args?: string[];
  dryRun?: boolean;
}

export interface ArtifactRunResult {
  artifactDir: string;
  runDir: string;
  scriptPath: string;
  command: string[];
  dryRun: boolean;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
}

const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const DEFAULT_OUT_DIR = ".tmp/browser-task-artifacts";
const SCHEMA_VERSION = "browser_task_artifact.v1";
const FINAL_SCRIPT_NAMES = ["final_script.ts", "final_script.js", "final_script.py"] as const;
const require = createRequire(import.meta.url);

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertTaskId(taskId: string) {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error("--task-id must match ^[a-z0-9][a-z0-9_-]*$");
  }
}

function assertScriptExt(scriptExt: string): asserts scriptExt is ArtifactScriptExt {
  if (!["ts", "js", "py"].includes(scriptExt)) {
    throw new Error("--script-ext must be one of: ts, js, py");
  }
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function taskMarkdown(params: {
  title: string;
  taskId: string;
  source: string;
  createdAt: string;
}) {
  return `# ${params.title}

Created UTC: ${params.createdAt}
Task ID: \`${params.taskId}\`
Source: \`${params.source}\`

## Original Task

TODO: paste the user request or exact browser task here.

## Assumptions

- TODO: list environment, account, data, viewport, and fixture assumptions.

## Secret Handling

- Do not write secrets, bearer values, private keys, auth headers, full .env contents, private account data, or sensitive screenshots into this workspace.
- Move only sanitized summaries into durable docs or issue comments.
`;
}

function planMarkdown() {
  return `# Critical Points

- [ ] CP1: TODO: exact page, state, filter, route, or result that must be proven.
- [ ] CP2: TODO: second independently verifiable requirement.

# Parameters

| Name | Default | Format / allowed values | Source phrase |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

# Verification Standard

Each critical point must cite at least one concrete evidence item:

- screenshot path;
- action log line;
- result.json field;
- command output;
- HTTP response summary without secrets.
`;
}

function verificationMarkdown() {
  return `# Verification

Latest clean run: \`final_runs/run_001\`

| Critical point | Evidence | Status |
|---|---|---|
| CP1 | TODO | pending |
| CP2 | TODO | pending |

## Completion Gate

- [ ] Final script reconstructs browser state from scratch.
- [ ] Action log records each task-relevant action.
- [ ] Screenshots prove all visual critical points.
- [ ] \`result.json\` contains the final structured result.
- [ ] No secrets or private payloads are present in logs, screenshots, or summaries.
`;
}

function actionLogMarkdown(createdAt: string) {
  return `# Action Log

Run: \`run_001\`
Created UTC: ${createdAt}
Status: draft

## Steps

- step 0 params: TODO
- step 1 action: TODO

## Final Result

TODO
`;
}

function scriptTemplate(scriptExt: ArtifactScriptExt) {
  if (scriptExt === "py") {
    return `#!/usr/bin/env python3
"""Draft browser task artifact script.

Replace this template with a Playwright script that reconstructs state from
scratch, writes action_log.md, saves screenshots, and updates result.json.
"""

from pathlib import Path


RUN_DIR = Path(__file__).parent


def main() -> None:
    print(f"Draft artifact script. Edit {RUN_DIR / 'final_script.py'} before running as proof.")


if __name__ == "__main__":
    main()
`;
  }

  return `/**
 * Draft browser task artifact script.
 *
 * Replace this template with a Playwright script that reconstructs state from
 * scratch, writes action_log.md, saves screenshots, and updates result.json.
 */

function main() {
  console.log("Draft artifact script. Edit this file before running as proof.");
}

main();
`;
}

export async function initBrowserTaskArtifact(options: ArtifactInitOptions): Promise<ArtifactInitResult> {
  const taskId = options.taskId;
  assertTaskId(taskId);
  const scriptExt = options.scriptExt ?? "ts";
  assertScriptExt(scriptExt);

  const outDir = path.resolve(options.outDir ?? DEFAULT_OUT_DIR);
  const workspaceDir = path.join(outDir, taskId);
  const runDir = path.join(workspaceDir, "final_runs", "run_001");
  const screenshotsDir = path.join(runDir, "screenshots");
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const title = options.title ?? taskId;
  const source = options.source ?? "TBD";

  if (await exists(workspaceDir)) {
    throw new Error(`Refusing to overwrite existing workspace: ${workspaceDir}`);
  }

  await mkdir(screenshotsDir, { recursive: true });

  const result = {
    schema_version: SCHEMA_VERSION,
    task_id: taskId,
    created_at: createdAt,
    status: "draft",
    command: "TODO",
    parameters: {},
    critical_points: [],
    evidence_refs: [],
    result: null,
    redaction: "secrets_not_collected",
  };

  const files = [
    [path.join(workspaceDir, "task.md"), taskMarkdown({ title, taskId, source, createdAt })],
    [path.join(workspaceDir, "plan.md"), planMarkdown()],
    [path.join(workspaceDir, "verification.md"), verificationMarkdown()],
    [path.join(runDir, "action_log.md"), actionLogMarkdown(createdAt)],
    [path.join(runDir, "result.json"), json(result)],
    [path.join(runDir, `final_script.${scriptExt}`), scriptTemplate(scriptExt)],
  ] as const;

  for (const [filePath, contents] of files) {
    await writeFile(filePath, contents, "utf8");
  }

  return {
    workspaceDir,
    runDir,
    files: files.map(([filePath]) => filePath),
  };
}

function check(status: ArtifactCheckStatus, name: string, message: string): ArtifactCheck {
  return { name, status, message };
}

async function fileCheck(filePath: string, label: string): Promise<ArtifactCheck> {
  return (await exists(filePath))
    ? check("pass", label, `Found ${filePath}`)
    : check("fail", label, `Missing ${filePath}`);
}

async function dirCheck(dirPath: string, label: string): Promise<ArtifactCheck> {
  return (await exists(dirPath))
    ? check("pass", label, `Found ${dirPath}`)
    : check("fail", label, `Missing ${dirPath}`);
}

function hasTodoOrPending(text: string) {
  return /\b(TODO|pending)\b/i.test(text);
}

async function latestRunDir(artifactDir: string) {
  const runsRoot = path.join(artifactDir, "final_runs");
  if (!(await exists(runsRoot))) return undefined;
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const runs = entries
    .filter((entry) => entry.isDirectory() && /^run_/.test(entry.name))
    .map((entry) => path.join(runsRoot, entry.name))
    .sort();
  return runs.at(-1);
}

async function countFiles(dirPath: string) {
  if (!(await exists(dirPath))) return 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(entryPath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

function validateResultJson(value: unknown, strict: boolean): ArtifactCheck[] {
  const checks: ArtifactCheck[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [check("fail", "result.json", "result.json must contain an object")];
  }

  const data = value as Record<string, unknown>;
  const issues: string[] = [];

  if (data.schema_version !== SCHEMA_VERSION) issues.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (!data.task_id || typeof data.task_id !== "string") issues.push("task_id must be a non-empty string");
  if (!["draft", "verified", "failed", "blocked"].includes(String(data.status))) {
    issues.push("status must be draft, verified, failed, or blocked");
  }
  if (!data.command || typeof data.command !== "string") issues.push("command must be a non-empty string");
  if (!data.parameters || typeof data.parameters !== "object" || Array.isArray(data.parameters)) {
    issues.push("parameters must be an object");
  }
  if (!Array.isArray(data.critical_points)) issues.push("critical_points must be an array");
  if (!Array.isArray(data.evidence_refs)) issues.push("evidence_refs must be an array");
  if (!data.redaction || typeof data.redaction !== "string") issues.push("redaction must be a non-empty string");

  if (strict) {
    if (data.status !== "verified") issues.push("strict mode requires status=verified");
    if (data.command === "TODO") issues.push("strict mode requires a non-placeholder command");
    if (!Array.isArray(data.critical_points) || data.critical_points.length === 0) {
      issues.push("strict mode requires non-empty critical_points");
    }
    if (!Array.isArray(data.evidence_refs) || data.evidence_refs.length === 0) {
      issues.push("strict mode requires non-empty evidence_refs");
    }
    if (data.result === null || data.result === undefined) issues.push("strict mode requires result");
  }

  checks.push(
    issues.length === 0
      ? check("pass", "result.json", "result.json shape is valid")
      : check("fail", "result.json", `result.json validation failed: ${issues.join("; ")}`),
  );
  return checks;
}

export async function checkBrowserTaskArtifact(
  artifactDir: string,
  options: { strict?: boolean } = {},
): Promise<ArtifactCheckResult> {
  const strict = Boolean(options.strict);
  const resolvedArtifactDir = path.resolve(artifactDir);
  const checks: ArtifactCheck[] = [];

  checks.push(await dirCheck(resolvedArtifactDir, "artifact directory"));
  if (!(await exists(resolvedArtifactDir))) {
    return { artifactDir: resolvedArtifactDir, checks };
  }

  checks.push(await fileCheck(path.join(resolvedArtifactDir, "task.md"), "task.md"));
  checks.push(await fileCheck(path.join(resolvedArtifactDir, "plan.md"), "plan.md"));
  checks.push(await fileCheck(path.join(resolvedArtifactDir, "verification.md"), "verification.md"));
  checks.push(await dirCheck(path.join(resolvedArtifactDir, "final_runs"), "final_runs"));

  const runDir = await latestRunDir(resolvedArtifactDir);
  if (!runDir) {
    checks.push(check("fail", "latest run", "No final_runs/run_* directory found"));
  } else {
    checks.push(check("pass", "latest run", `Latest run: ${runDir}`));
    checks.push(await dirCheck(path.join(runDir, "screenshots"), "screenshots"));
    checks.push(await fileCheck(path.join(runDir, "result.json"), "result.json"));

    const scripts = FINAL_SCRIPT_NAMES.map((name) => path.join(runDir, name));
    checks.push(
      (await Promise.all(scripts.map(exists))).some(Boolean)
        ? check("pass", "final_script", "Found final_script")
        : check("fail", "final_script", "Missing final_script.ts, final_script.js, or final_script.py"),
    );

    const logs = [path.join(runDir, "action_log.md"), path.join(runDir, "action_log.jsonl")];
    checks.push(
      (await Promise.all(logs.map(exists))).some(Boolean)
        ? check("pass", "action log", "Found action log")
        : check("fail", "action log", "Missing action_log.md or action_log.jsonl"),
    );

    const resultPath = path.join(runDir, "result.json");
    if (await exists(resultPath)) {
      try {
        checks.push(...validateResultJson(JSON.parse(await readFile(resultPath, "utf8")), strict));
      } catch (error) {
        checks.push(check("fail", "result.json", `result.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    if (strict) {
      const screenshotCount = await countFiles(path.join(runDir, "screenshots"));
      checks.push(
        screenshotCount > 0
          ? check("pass", "screenshots", `Screenshots present: ${screenshotCount}`)
          : check("fail", "screenshots", "strict mode requires at least one screenshot"),
      );
    }
  }

  const verificationPath = path.join(resolvedArtifactDir, "verification.md");
  if (await exists(verificationPath)) {
    const markerCheck = hasTodoOrPending(await readFile(verificationPath, "utf8"));
    checks.push(
      markerCheck
        ? check(strict ? "fail" : "warn", "verification.md", "verification.md still contains TODO or pending markers")
        : check("pass", "verification.md", "verification.md has no TODO/pending markers"),
    );
  }

  return { artifactDir: resolvedArtifactDir, latestRunDir: runDir, checks };
}

async function resolveArtifactRunDir(artifactDir: string, runId?: string) {
  if (runId) {
    const runDir = path.join(artifactDir, "final_runs", runId);
    if (!(await exists(runDir))) {
      throw new Error(`Artifact run not found: ${runDir}`);
    }
    return runDir;
  }

  const runDir = await latestRunDir(artifactDir);
  if (!runDir) {
    throw new Error(`No final_runs/run_* directory found in ${artifactDir}`);
  }
  return runDir;
}

async function resolveArtifactScript(runDir: string, script?: string) {
  if (script) {
    const scriptPath = path.isAbsolute(script) ? script : path.resolve(runDir, script);
    if (!(await exists(scriptPath))) {
      throw new Error(`Artifact script not found: ${scriptPath}`);
    }
    return scriptPath;
  }

  const scripts = FINAL_SCRIPT_NAMES.map((name) => path.join(runDir, name));
  const existingScripts = (await Promise.all(scripts.map(async (scriptPath) => ((await exists(scriptPath)) ? scriptPath : undefined)))).filter(
    (scriptPath): scriptPath is string => Boolean(scriptPath),
  );

  if (existingScripts.length === 0) {
    throw new Error(`No ${FINAL_SCRIPT_NAMES.join(", ")} found in ${runDir}`);
  }

  if (existingScripts.length > 1) {
    throw new Error(`Multiple final scripts found in ${runDir}; pass --script to choose one.`);
  }

  return existingScripts[0];
}

function commandForArtifactScript(scriptPath: string, args: string[]) {
  const ext = path.extname(scriptPath);
  if (ext === ".js") {
    return [process.execPath, scriptPath, ...args];
  }
  if (ext === ".py") {
    return ["python3", scriptPath, ...args];
  }
  if (ext === ".ts") {
    return [process.execPath, require.resolve("tsx/cli"), scriptPath, ...args];
  }
  throw new Error(`Unsupported artifact script extension: ${ext}`);
}

export async function runBrowserTaskArtifact(options: ArtifactRunOptions): Promise<ArtifactRunResult> {
  const resolvedArtifactDir = path.resolve(options.artifactDir);
  if (!(await exists(resolvedArtifactDir))) {
    throw new Error(`Artifact directory not found: ${resolvedArtifactDir}`);
  }

  const runDir = await resolveArtifactRunDir(resolvedArtifactDir, options.runId);
  const scriptPath = await resolveArtifactScript(runDir, options.script);
  const command = commandForArtifactScript(scriptPath, options.args ?? []);

  if (options.dryRun) {
    return {
      artifactDir: resolvedArtifactDir,
      runDir,
      scriptPath,
      command,
      dryRun: true,
    };
  }

  const child = spawn(command[0], command.slice(1), {
    cwd: runDir,
    stdio: "inherit",
  });

  const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });

  return {
    artifactDir: resolvedArtifactDir,
    runDir,
    scriptPath,
    command,
    dryRun: false,
    ...result,
  };
}
