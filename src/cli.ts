#!/usr/bin/env node
import { confirm, input, select } from "@inquirer/prompts";
import { Command, Option } from "commander";
import { commandsForPackageManager, detectPackageManager } from "./package-manager.js";
import { getTemplatePreset, templateNames } from "./presets.js";
import { detectProjectDefaults } from "./framework.js";
import { initProject } from "./init.js";
import { addRouteToSpec } from "./add-route.js";
import { doctorProject } from "./doctor.js";
import { installSkill, type SkillTarget } from "./skills.js";
import type { CiProvider, InitOptions, PackageManager, TemplateName } from "./types.js";

function collect(value: string, previous: string[]) {
  return [...previous, value];
}

async function maybePrompt(options: InitOptions): Promise<InitOptions> {
  if (options.yes || !process.stdin.isTTY) return options;

  const appDir = await input({
    message: "App directory",
    default: options.appDir || ".",
  });
  const repoRoot = await input({
    message: "Repository root",
    default: options.repoRoot || ".",
  });

  const detectedManager = options.packageManager ?? (await detectPackageManager(appDir));
  const packageManager = await select<PackageManager>({
    message: "Package manager",
    default: detectedManager,
    choices: [
      { name: "npm", value: "npm" },
      { name: "pnpm", value: "pnpm" },
      { name: "yarn", value: "yarn" },
      { name: "bun", value: "bun" },
    ],
  });

  const detectedProject = await detectProjectDefaults(appDir, packageManager);
  const template = await select<TemplateName>({
    message: "Project template",
    default: options.template ?? detectedProject.template,
    choices: templateNames.map((name) => ({ name, value: name })),
  });

  const preset = getTemplatePreset(template, packageManager);
  const webCommand = await input({
    message: "Web app command",
    default: options.webCommand ?? detectedProject.webCommand ?? preset.webCommand,
  });
  const webPort = Number(
    await input({
      message: "Web app port",
      default: String(options.webPort ?? detectedProject.webPort ?? preset.webPort),
    }),
  );

  const addApi =
    template === "app-plus-api" ||
    Boolean(options.apiCommand) ||
    (await confirm({ message: "Start an API server too?", default: false }));

  const apiCommand = addApi
    ? await input({
        message: "API command",
        default: options.apiCommand ?? preset.apiCommand ?? "PORT=3001 npm run dev:api",
      })
    : undefined;
  const apiUrl = addApi
    ? await input({
        message: "API health URL",
        default: options.apiUrl ?? preset.apiUrl ?? "http://127.0.0.1:3001/api/health",
      })
    : undefined;

  const routes = await input({
    message: "Routes, comma-separated as /path::Visible marker",
    default:
      options.routes?.join(",") ??
      preset.routes.map((route) => `${route.path}::${route.marker}`).join(","),
  });

  const ci = await select<CiProvider>({
    message: "CI provider",
    default: options.ci ?? "github",
    choices: [
      { name: "GitHub Actions", value: "github" },
      { name: "None", value: "none" },
    ],
  });

  const skipInstall = !(await confirm({
    message: `Run "${commandsForPackageManager(packageManager).addDev}" after writing files?`,
    default: !options.skipInstall,
  }));

  return {
    ...options,
    repoRoot,
    appDir,
    packageManager,
    template,
    webCommand,
    webPort,
    apiCommand,
    apiUrl,
    routes: routes
      .split(",")
      .map((route) => route.trim())
      .filter(Boolean),
    ci,
    skipInstall,
  };
}

async function main() {
  const program = new Command();
  program
    .name("playwright-ui-smoke-kit")
    .description("Install a Chromium-only Playwright UI smoke check.")
    .version("0.1.0");

  program
    .command("init")
    .description("Add Playwright UI smoke files to a web project.")
    .option("--repo-root <dir>", "repository root for .github/workflows", ".")
    .option("--app-dir <dir>", "directory with package.json", ".")
    .addOption(new Option("--template <name>", "template preset").choices(templateNames))
    .addOption(new Option("--package-manager <name>", "package manager").choices(["npm", "pnpm", "yarn", "bun"]))
    .option("--web-command <command>", "command that starts the web app")
    .option("--web-port <port>", "web app port", (value) => Number(value))
    .option("--api-command <command>", "optional API command")
    .option("--api-url <url>", "optional API health URL")
    .option("--route <route>", "repeatable route as /path::Visible marker", collect, [])
    .option("--script-name <name>", "package.json script name", "smoke:web-ui")
    .option("--test-dir <dir>", "directory for generated Playwright smoke tests", "tests")
    .option("--workflow-name <name>", "GitHub Actions workflow file name", "playwright-ui-smoke.yml")
    .option("--web-env <entry>", "repeatable web server env as KEY=value", collect, [])
    .option("--api-env <entry>", "repeatable API server env as KEY=value", collect, [])
    .addOption(new Option("--ci <provider>", "CI provider").choices(["github", "none"]).default("github"))
    .option("--dry-run", "print planned changes without writing files")
    .option("--force", "overwrite generated files and replace smoke:web-ui script")
    .option("--yes", "accept defaults and skip interactive prompts")
    .option("--skip-install", "do not install @playwright/test")
    .action(async (options: InitOptions) => {
      const finalOptions = await maybePrompt(options);
      const result = await initProject(finalOptions);

      const verb = result.dryRun ? "Would write" : "Wrote";
      console.log(`${verb} Playwright UI smoke setup in ${result.appDir}`);
      for (const file of result.files) {
        console.log(`- ${file}`);
      }
      console.log(`- package.json`);
      if (result.installCommand) {
        console.log(`Installed dependency with: ${result.installCommand}`);
      }
      if (result.dryRun && !finalOptions.skipInstall) {
        console.log(`Install command: ${commandsForPackageManager(result.packageManager).addDev}`);
      }
    });

  program
    .command("doctor")
    .description("Check an existing Playwright UI smoke setup.")
    .option("--repo-root <dir>", "repository root for .github/workflows", ".")
    .option("--app-dir <dir>", "directory with package.json", ".")
    .option("--script-name <name>", "package.json script name", "smoke:web-ui")
    .option("--test-dir <dir>", "directory for generated Playwright smoke tests", "tests")
    .option("--workflow-name <name>", "GitHub Actions workflow file name", "playwright-ui-smoke.yml")
    .action(async (options: { repoRoot: string; appDir: string; scriptName: string; testDir: string; workflowName: string }) => {
      const checks = await doctorProject(options);
      for (const check of checks) {
        const icon = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
        console.log(`[${icon}] ${check.name}: ${check.message}`);
      }
      if (checks.some((check) => check.status === "fail")) {
        process.exitCode = 1;
      }
    });

  program
    .command("add-route")
    .description("Add one route marker to generated tests/ui-smoke.spec.ts.")
    .argument("<route>", "route as /path::Visible marker")
    .option("--app-dir <dir>", "directory with package.json", ".")
    .option("--test-dir <dir>", "directory with ui-smoke.spec.ts", "tests")
    .option("--dry-run", "print planned change without writing files")
    .action(async (route: string, options: { appDir: string; testDir: string; dryRun?: boolean }) => {
      const result = await addRouteToSpec({ ...options, route });
      if (!result.changed) {
        console.log(`Route ${result.route.path} already exists in ${result.specPath}`);
        return;
      }
      console.log(`${options.dryRun ? "Would add" : "Added"} ${result.route.path} to ${result.specPath}`);
    });

  program
    .command("install-skill")
    .description("Install the bundled Codex or OpenClaw skill.")
    .argument("<target>", "codex | openclaw")
    .option("--dry-run", "print target path without copying files")
    .option("--force", "replace existing skill directory")
    .action(async (target: string, options: { dryRun?: boolean; force?: boolean }) => {
      if (!["codex", "openclaw"].includes(target)) {
        throw new Error(`Unsupported skill target: ${target}`);
      }
      const result = await installSkill({ target: target as SkillTarget, ...options });
      console.log(`${options.dryRun ? "Would install" : "Installed"} ${target} skill`);
      console.log(`- from ${result.source}`);
      console.log(`- to ${result.destination}`);
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`playwright-ui-smoke-kit: ${message}`);
  process.exit(1);
});
