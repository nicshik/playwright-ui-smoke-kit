import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { runScriptCommand } from "./package-manager.js";
import type { PackageManager, TemplateName } from "./types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DetectedProjectDefaults {
  template: TemplateName;
  webCommand?: string;
  webPort?: number;
  framework: "vite" | "next" | "astro" | "sveltekit" | "nuxt" | "unknown";
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hasDependency(packageJson: PackageJson, name: string) {
  return Boolean(packageJson.dependencies?.[name] || packageJson.devDependencies?.[name]);
}

async function readPackageJson(appDir: string): Promise<PackageJson> {
  try {
    return JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8")) as PackageJson;
  } catch {
    return {};
  }
}

export async function detectProjectDefaults(
  appDir: string,
  manager: PackageManager,
): Promise<DetectedProjectDefaults> {
  const packageJson = await readPackageJson(appDir);

  if (hasDependency(packageJson, "next")) {
    return { template: "next-app", framework: "next" };
  }
  if (hasDependency(packageJson, "astro")) {
    return {
      template: "vite-app",
      framework: "astro",
      webCommand: runScriptCommand(manager, "dev", "-- --host 127.0.0.1"),
      webPort: 4321,
    };
  }
  if (hasDependency(packageJson, "@sveltejs/kit")) {
    return { template: "vite-app", framework: "sveltekit" };
  }
  if (hasDependency(packageJson, "nuxt")) {
    return {
      template: "vite-app",
      framework: "nuxt",
      webCommand: runScriptCommand(manager, "dev", "-- --host 127.0.0.1"),
      webPort: 3000,
    };
  }
  if (
    hasDependency(packageJson, "vite") ||
    (await exists(path.join(appDir, "vite.config.ts"))) ||
    (await exists(path.join(appDir, "vite.config.js")))
  ) {
    return { template: "vite-app", framework: "vite" };
  }

  return { template: "vite-app", framework: "unknown" };
}
