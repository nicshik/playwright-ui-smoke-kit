import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { accessSync, readFileSync } from "node:fs";
import {
  assertPackageManager,
  commandsForPackageManager,
  detectPackageManager,
} from "./package-manager.js";
import { assertTemplateName, getTemplatePreset } from "./presets.js";
import { parseRoutes } from "./routes.js";
import { renderGithubWorkflow, renderPlaywrightConfig, renderUiSmokeSpec } from "./render.js";
import type {
  CiProvider,
  InitOptions,
  InitResult,
  PackageManager,
  TemplateName,
  WebServerSpec,
} from "./types.js";

const PLAYWRIGHT_VERSION = "^1.59.1";

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

function normalizeRelativeAppDir(appDir: string) {
  const relative = path.relative(process.cwd(), path.resolve(appDir));
  if (!relative || relative === "") return ".";
  return relative.startsWith("..") ? appDir : relative;
}

function buildWebServers(options: {
  webCommand: string;
  webPort: number;
  apiCommand?: string;
  apiUrl?: string;
}) {
  const servers: WebServerSpec[] = [];
  if (options.apiCommand && options.apiUrl) {
    servers.push({ command: options.apiCommand, url: options.apiUrl });
  }
  servers.push({
    command: options.webCommand,
    url: `http://127.0.0.1:${options.webPort}/`,
  });
  return servers;
}

function mergePackageJson(
  packageJson: Awaited<ReturnType<typeof readPackageJson>>["packageJson"],
  force: boolean,
) {
  const currentSmokeScript = packageJson.scripts?.["smoke:web-ui"];
  if (currentSmokeScript && currentSmokeScript !== "playwright test" && !force) {
    throw new Error(
      `package.json already has a different "smoke:web-ui" script. Use --force to replace it.`,
    );
  }

  const hadPlaywright =
    Boolean(packageJson.devDependencies?.["@playwright/test"]) ||
    Boolean(packageJson.dependencies?.["@playwright/test"]);

  packageJson.scripts = {
    ...packageJson.scripts,
    "smoke:web-ui": "playwright test",
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
  const appDir = path.resolve(rawOptions.appDir || ".");
  const ci = rawOptions.ci ?? "github";
  assertCiProvider(ci);

  const packageManager = rawOptions.packageManager ?? (await detectPackageManager(appDir));
  assertPackageManager(packageManager);

  const template = rawOptions.template ?? "vite-app";
  assertTemplateName(template);

  const preset = getTemplatePreset(template, packageManager);
  const webCommand = rawOptions.webCommand ?? preset.webCommand;
  const webPort = rawOptions.webPort ?? preset.webPort;
  const apiCommand = rawOptions.apiCommand ?? preset.apiCommand;
  const apiUrl = rawOptions.apiUrl ?? preset.apiUrl;
  const routes = parseRoutes(rawOptions.routes, preset.routes);

  const { packageJsonPath, packageJson } = await readPackageJson(appDir);
  const packageMerge = mergePackageJson(packageJson, Boolean(rawOptions.force));

  const webServers = buildWebServers({
    webCommand,
    webPort,
    apiCommand,
    apiUrl,
  });

  const files = new Map<string, string>();
  files.set(
    path.join(appDir, "playwright.config.ts"),
    renderPlaywrightConfig({
      baseURL: `http://127.0.0.1:${webPort}`,
      webServers,
    }),
  );
  files.set(path.join(appDir, "tests", "ui-smoke.spec.ts"), renderUiSmokeSpec(routes));
  if (ci === "github") {
    files.set(
      path.join(appDir, ".github", "workflows", "playwright-ui-smoke.yml"),
      renderGithubWorkflow({
        appDir: normalizeRelativeAppDir(appDir),
        packageManager,
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
    appDir,
    packageManager,
    template,
    files: [...files.keys()],
    packageJsonUpdated: true,
    installCommand:
      rawOptions.skipInstall || packageMerge.hadPlaywright
        ? undefined
        : commandsForPackageManager(packageManager).addDev,
    dryRun: Boolean(rawOptions.dryRun),
  };
}
