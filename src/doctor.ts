import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
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
    status: (await exists(workflowPath)) ? "pass" : "warn",
    message: (await exists(workflowPath)) ? `Found ${workflowPath}` : `Missing ${workflowPath}`,
  });

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
