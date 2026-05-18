import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { parse } from "yaml";
import { detectPackageManager } from "./package-manager.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function checkPort(port: number) {
  return new Promise<"free" | "in-use">((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve("in-use"));
    server.once("listening", () => {
      server.close(() => resolve("free"));
    });
    server.listen(port, "127.0.0.1");
  });
}

function extractPorts(playwrightConfig: string) {
  const ports = new Set<number>();
  for (const match of playwrightConfig.matchAll(/127\.0\.0\.1:(\d+)/g)) {
    ports.add(Number(match[1]));
  }
  return [...ports].filter((port) => Number.isInteger(port) && port > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function workflowEvent(workflow: Record<string, unknown>, name: string) {
  return asRecord(asRecord(workflow.on)[name]);
}

function hasBranches(event: Record<string, unknown>) {
  return Array.isArray(event.branches) && event.branches.length > 0;
}

function hasPathFilter(event: Record<string, unknown>) {
  return (
    (Array.isArray(event.paths) && event.paths.length > 0) ||
    (Array.isArray(event["paths-ignore"]) && event["paths-ignore"].length > 0)
  );
}

function inspectWorkflow(workflowText: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  let workflow: Record<string, unknown>;

  try {
    workflow = asRecord(parse(workflowText));
  } catch (error) {
    return [{
      name: "workflow syntax",
      status: "fail",
      message: `Could not parse workflow YAML: ${error instanceof Error ? error.message : String(error)}`,
    }];
  }

  const push = workflowEvent(workflow, "push");
  const pullRequest = workflowEvent(workflow, "pull_request");
  const pushBounded = Object.keys(push).length > 0 && hasBranches(push);
  const pullRequestBounded = Object.keys(pullRequest).length > 0 && hasBranches(pullRequest);

  checks.push({
    name: "workflow trigger scope",
    status: pushBounded && pullRequestBounded ? "pass" : "warn",
    message: pushBounded && pullRequestBounded
      ? "push and pull_request are limited to base branches"
      : "Limit push and pull_request to the base branch to avoid duplicate branch and PR runs",
  });

  checks.push({
    name: "workflow concurrency",
    status: workflow.concurrency ? "pass" : "warn",
    message: workflow.concurrency
      ? "Stale runs on the same branch or PR are cancelled"
      : "Add concurrency.cancel-in-progress to cancel stale runs",
  });

  const jobs = asRecord(workflow.jobs);
  const timeoutValues = Object.values(jobs)
    .map((job) => asRecord(job)["timeout-minutes"])
    .filter((value): value is number => typeof value === "number");
  const highTimeout = timeoutValues.some((value) => value > 15);
  checks.push({
    name: "workflow timeout",
    status: highTimeout ? "warn" : "pass",
    message: highTimeout
      ? `Reduce UI smoke timeout from ${Math.max(...timeoutValues)} minutes unless the app needs it`
      : "Timeout is in the expected 10-15 minute range",
  });

  const hasFilter = hasPathFilter(push) || hasPathFilter(pullRequest);
  checks.push({
    name: "workflow path filter",
    status: hasFilter ? "pass" : "warn",
    message: hasFilter
      ? "Workflow has a path filter to avoid unrelated runs"
      : "Add paths or paths-ignore so docs-only changes do not spend browser minutes",
  });

  checks.push({
    name: "required check policy",
    status: "pass",
    message: hasFilter
      ? "Do not make this path-filtered workflow the only required check; use a separate always-running gate"
      : "If this workflow becomes required, keep it always-running or add a separate required gate",
  });

  return checks;
}

export async function doctorProject(options: {
  repoRoot?: string;
  appDir: string;
  scriptName?: string;
  testDir?: string;
  workflowName?: string;
}): Promise<DoctorCheck[]> {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const appDir = path.resolve(options.appDir || ".");
  const scriptName = options.scriptName ?? "smoke:web-ui";
  const testDir = options.testDir ?? "tests";
  const workflowName = options.workflowName ?? "playwright-ui-smoke.yml";
  const checks: DoctorCheck[] = [];

  const packageJsonPath = path.join(appDir, "package.json");
  const packageJsonExists = await exists(packageJsonPath);
  checks.push({
    name: "package.json",
    status: packageJsonExists ? "pass" : "fail",
    message: packageJsonExists ? `Found ${packageJsonPath}` : `Missing ${packageJsonPath}`,
  });

  if (packageJsonExists) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const manager = await detectPackageManager(appDir);
    checks.push({ name: "package manager", status: "pass", message: `Detected ${manager}` });
    const hasPlaywright = Boolean(
      packageJson.devDependencies?.["@playwright/test"] || packageJson.dependencies?.["@playwright/test"],
    );
    checks.push({
      name: "@playwright/test",
      status: hasPlaywright ? "pass" : "fail",
      message: hasPlaywright ? "Installed locally" : "Missing local @playwright/test dependency",
    });
    checks.push({
      name: scriptName,
      status: packageJson.scripts?.[scriptName] ? "pass" : "fail",
      message: packageJson.scripts?.[scriptName]
        ? `Script runs: ${packageJson.scripts[scriptName]}`
        : `Missing package script "${scriptName}"`,
    });
  }

  const configPath = path.join(appDir, "playwright.config.ts");
  const specPath = path.join(appDir, testDir, "ui-smoke.spec.ts");
  const workflowPath = path.join(repoRoot, ".github", "workflows", workflowName);
  const config = await readText(configPath);
  const workflowText = await readText(workflowPath);

  checks.push({
    name: "playwright.config.ts",
    status: config ? "pass" : "fail",
    message: config ? `Found ${configPath}` : `Missing ${configPath}`,
  });
  checks.push({
    name: "ui-smoke.spec.ts",
    status: (await exists(specPath)) ? "pass" : "fail",
    message: (await exists(specPath)) ? `Found ${specPath}` : `Missing ${specPath}`,
  });
  checks.push({
    name: "GitHub Actions workflow",
    status: workflowText ? "pass" : "warn",
    message: workflowText ? `Found ${workflowPath}` : `Missing ${workflowPath}`,
  });

  if (workflowText) {
    checks.push(...inspectWorkflow(workflowText));
  }

  if (config) {
    for (const port of extractPorts(config)) {
      const state = await checkPort(port);
      checks.push({
        name: `port ${port}`,
        status: state === "free" ? "pass" : "warn",
        message: state === "free" ? "Free on 127.0.0.1" : "Already in use on 127.0.0.1",
      });
    }
  }

  return checks;
}
