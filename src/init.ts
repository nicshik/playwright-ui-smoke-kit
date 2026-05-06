import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { accessSync, readFileSync } from "node:fs";
import {
  assertPackageManager,
  commandsForPackageManager,
  detectPackageManager,
} from "./package-manager.js";
import { detectProjectDefaults } from "./framework.js";
import { assertTemplateName, getTemplatePreset } from "./presets.js";
import { parseRoutes } from "./routes.js";
import {
  renderGithubWorkflow,
  renderPlaywrightConfig,
  renderStaticServer,
  renderUiSmokeSpec,
} from "./render.js";
import type {
  CiProvider,
  InitOptions,
  InitResult,
  PackageManager,
  TemplateName,
  WebServerSpec,
} from "./types.js";

const PLAYWRIGHT_VERSION = "^1.59.1";
const DEFAULT_SCRIPT_NAME = "smoke:web-ui";
const DEFAULT_TEST_DIR = "tests";
const DEFAULT_WORKFLOW_NAME = "playwright-ui-smoke.yml";

function exists(filePath: string) {
  try {
    accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertCiProvider(value: string): asserts value is CiProvider {
  if (!["github", "none"].includes(value)) {
    throw new Error(`Unsupported CI provider: ${value}`);
  }
}

async function readPackageJson(appDir: string) {
  const packageJsonPath = path.join(appDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  return { packageJsonPath, packageJson };
}

function relativeAppDir(repoRoot: string, appDir: string) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(appDir));
  if (!relative || relative === "") return ".";
  return relative.startsWith("..") ? appDir : relative;
}

function parseEnv(values: string[] | undefined) {
  const env: Record<string, string> = {};
  for (const value of values ?? []) {
    const separator = value.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Environment entries must use KEY=value format: ${value}`);
    }
    const key = value.slice(0, separator).trim();
    const envValue = value.slice(separator + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }
    env[key] = envValue;
  }
  return env;
}

function mergeEnv(
  base: Record<string, string> | undefined,
  overrides: Record<string, string>,
) {
  const merged = { ...(base ?? {}), ...overrides };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function buildWebServers(options: {
  webCommand: string;
  webPort: number;
  webEnv?: Record<string, string>;
  apiCommand?: string;
  apiUrl?: string;
  apiEnv?: Record<string, string>;
}) {
  const servers: WebServerSpec[] = [];
  if (options.apiCommand && options.apiUrl) {
    servers.push({ command: options.apiCommand, url: options.apiUrl, env: options.apiEnv });
  }
  servers.push({
    command: options.webCommand,
    url: `http://127.0.0.1:${options.webPort}/`,
    env: options.webEnv,
  });
  return servers;
}

function mergePackageJson(
  packageJson: Awaited<ReturnType<typeof readPackageJson>>["packageJson"],
  force: boolean,
  scriptName: string,
) {
  const currentSmokeScript = packageJson.scripts?.[scriptName];
  if (currentSmokeScript && currentSmokeScript !== "playwright test" && !force) {
    throw new Error(
      `package.json already has a different "${scriptName}" script. Use --force to replace it.`,
    );
  }

  const hadPlaywright =
    Boolean(packageJson.devDependencies?.["@playwright/test"]) ||
    Boolean(packageJson.dependencies?.["@playwright/test"]);

  packageJson.scripts = {
    ...packageJson.scripts,
    [scriptName]: "playwright test",
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@playwright/test": packageJson.devDependencies?.["@playwright/test"] ?? PLAYWRIGHT_VERSION,
  };

  return { hadPlaywright };
}

function ensureSafeWrites(files: Map<string, string>, force: boolean) {
  for (const [filePath, contents] of files) {
    if (!exists(filePath)) continue;
    const current = readFileSync(filePath, "utf8");
    if (current === contents) continue;
    if (!force) {
      throw new Error(`${filePath} already exists. Use --force to overwrite it.`);
    }
    if (contents.length === 0) {
      throw new Error(`Refusing to write empty file: ${filePath}`);
    }
  }
}

function runInstallCommand(manager: PackageManager, appDir: string) {
  const installCommand = commandsForPackageManager(manager).addDev;
  const result = spawnSync(installCommand, {
    cwd: appDir,
    shell: true,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Install command failed: ${installCommand}`);
  }
}

export async function initProject(rawOptions: InitOptions): Promise<InitResult> {
  const repoRoot = path.resolve(rawOptions.repoRoot || process.cwd());
  const appDir = path.resolve(rawOptions.appDir || ".");
  const ci = rawOptions.ci ?? "github";
  assertCiProvider(ci);

  const packageManager = rawOptions.packageManager ?? (await detectPackageManager(appDir));
  assertPackageManager(packageManager);

  const detectedDefaults = await detectProjectDefaults(appDir, packageManager);
  const template = rawOptions.template ?? detectedDefaults.template;
  assertTemplateName(template);

  const preset = getTemplatePreset(template, packageManager);
  const scriptName = rawOptions.scriptName ?? DEFAULT_SCRIPT_NAME;
  const testDir = rawOptions.testDir ?? DEFAULT_TEST_DIR;
  const workflowName = rawOptions.workflowName ?? DEFAULT_WORKFLOW_NAME;
  let webCommand = rawOptions.webCommand ?? detectedDefaults.webCommand ?? preset.webCommand;
  if (preset.staticServer && !rawOptions.webCommand) {
    webCommand = `node ${testDir}/static-server.mjs`;
  }
  const webPort = rawOptions.webPort ?? detectedDefaults.webPort ?? preset.webPort;
  const apiCommand = rawOptions.apiCommand ?? preset.apiCommand;
  const apiUrl = rawOptions.apiUrl ?? preset.apiUrl;
  const webEnv = mergeEnv(preset.webEnv, parseEnv(rawOptions.webEnv));
  const apiEnv = mergeEnv(preset.apiEnv, parseEnv(rawOptions.apiEnv));
  const routes = parseRoutes(rawOptions.routes, preset.routes);

  const { packageJsonPath, packageJson } = await readPackageJson(appDir);
  const packageMerge = mergePackageJson(packageJson, Boolean(rawOptions.force), scriptName);

  const webServers = buildWebServers({
    webCommand,
    webPort,
    webEnv,
    apiCommand,
    apiUrl,
    apiEnv,
  });

  const files = new Map<string, string>();
  files.set(
    path.join(appDir, "playwright.config.ts"),
    renderPlaywrightConfig({
      baseURL: `http://127.0.0.1:${webPort}`,
      testDir: `./${testDir}`,
      webServers,
    }),
  );
  files.set(path.join(appDir, testDir, "ui-smoke.spec.ts"), renderUiSmokeSpec(routes));
  if (preset.staticServer) {
    files.set(path.join(appDir, testDir, "static-server.mjs"), renderStaticServer());
  }
  if (ci === "github") {
    files.set(
      path.join(repoRoot, ".github", "workflows", workflowName),
      renderGithubWorkflow({
        appDir: relativeAppDir(repoRoot, appDir),
        packageManager,
        scriptName,
      }),
    );
  }

  ensureSafeWrites(files, Boolean(rawOptions.force));

  if (!rawOptions.dryRun) {
    for (const [filePath, contents] of files) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
    }
    await writeFile(`${packageJsonPath}`, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    if (!rawOptions.skipInstall && !packageMerge.hadPlaywright) {
      runInstallCommand(packageManager, appDir);
    }
  }

  return {
    repoRoot,
    appDir,
    packageManager,
    template,
    scriptName,
    testDir,
    files: [...files.keys()],
    packageJsonUpdated: true,
    installCommand:
      rawOptions.skipInstall || packageMerge.hadPlaywright
        ? undefined
        : commandsForPackageManager(packageManager).addDev,
    dryRun: Boolean(rawOptions.dryRun),
  };
}
