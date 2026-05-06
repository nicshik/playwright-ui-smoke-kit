import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageManager } from "./types.js";

export interface PackageManagerCommands {
  addDev: string;
  install: string;
  installFrozen: string;
  playwrightInstall: string;
  runSmoke: string;
}

const lockfileManagers: Array<[string, PackageManager]> = [
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
];

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function managerFromPackageManagerField(value: string): PackageManager | undefined {
  if (value.startsWith("npm@")) return "npm";
  if (value.startsWith("pnpm@")) return "pnpm";
  if (value.startsWith("yarn@")) return "yarn";
  if (value.startsWith("bun@")) return "bun";
  return undefined;
}

export async function detectPackageManager(appDir: string): Promise<PackageManager> {
  const packageJsonPath = path.join(appDir, "package.json");
  if (await exists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      packageManager?: string;
    };
    if (packageJson.packageManager) {
      const manager = managerFromPackageManagerField(packageJson.packageManager);
      if (manager) return manager;
    }
  }

  for (const [lockfile, manager] of lockfileManagers) {
    if (await exists(path.join(appDir, lockfile))) return manager;
  }

  return "npm";
}

export function assertPackageManager(value: string): asserts value is PackageManager {
  if (!["npm", "pnpm", "yarn", "bun"].includes(value)) {
    throw new Error(`Unsupported package manager: ${value}`);
  }
}

export function commandsForPackageManager(manager: PackageManager): PackageManagerCommands {
  switch (manager) {
    case "npm":
      return {
        addDev: "npm install -D @playwright/test",
        install: "npm install",
        installFrozen: "npm ci",
        playwrightInstall: "npx playwright install --with-deps chromium",
        runSmoke: "npm run smoke:web-ui",
      };
    case "pnpm":
      return {
        addDev: "pnpm add -D @playwright/test",
        install: "pnpm install",
        installFrozen: "pnpm install --frozen-lockfile",
        playwrightInstall: "pnpm exec playwright install --with-deps chromium",
        runSmoke: "pnpm run smoke:web-ui",
      };
    case "yarn":
      return {
        addDev: "yarn add -D @playwright/test",
        install: "yarn install",
        installFrozen: "yarn install --immutable || yarn install --frozen-lockfile",
        playwrightInstall: "yarn playwright install --with-deps chromium",
        runSmoke: "yarn smoke:web-ui",
      };
    case "bun":
      return {
        addDev: "bun add -d @playwright/test",
        install: "bun install",
        installFrozen: "bun install --frozen-lockfile",
        playwrightInstall: "bunx playwright install --with-deps chromium",
        runSmoke: "bun run smoke:web-ui",
      };
  }
}

export function runScriptCommand(manager: PackageManager, script: string, args = "") {
  const suffix = args ? ` ${args}` : "";
  switch (manager) {
    case "npm":
      return `npm run ${script}${suffix}`;
    case "pnpm":
      return `pnpm run ${script}${suffix}`;
    case "yarn":
      return `yarn ${script}${suffix.replace(/^ -- /, " ")}`;
    case "bun":
      return `bun run ${script}${suffix}`;
  }
}

export function lockfileForPackageManager(manager: PackageManager) {
  switch (manager) {
    case "npm":
      return "package-lock.json";
    case "pnpm":
      return "pnpm-lock.yaml";
    case "yarn":
      return "yarn.lock";
    case "bun":
      return "bun.lockb";
  }
}
