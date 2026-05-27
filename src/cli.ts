#!/usr/bin/env node
import { confirm, input, select } from "@inquirer/prompts";
import { Command, Option } from "commander";
import { createRequire } from "node:module";
import { commandsForPackageManager, detectPackageManager } from "./package-manager.js";
import { getTemplatePreset, templateNames } from "./presets.js";
import { detectProjectDefaults } from "./framework.js";
import { initProject } from "./init.js";
import { addRouteToSpec } from "./add-route.js";
import { doctorProject } from "./doctor.js";
import { installSkills, type SkillSelection, type SkillTarget } from "./skills.js";
import { checkBrowserTaskArtifact, initBrowserTaskArtifact, runBrowserTaskArtifact } from "./artifact.js";
import type { CiProvider, InitOptions, PackageManager, TemplateName } from "./types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

function collect(value: string, previous: string[]) {
  return [...previous, value];
}

function shellQuote(value: string) {
  return /^[A-Za-z0-9_/:=.,@%+-]+$/.test(value) ? value : JSON.stringify(value);
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
    .version(packageJson.version);

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
    .option("--base-branch <name>", "base branch for generated GitHub Actions triggers")
    .option("--workflow-path <glob>", "repeatable extra GitHub Actions path glob", collect, [])
    .option("--workflow-all-changes", "run the generated workflow for all changed files")
    .option("--workflow-timeout <minutes>", "GitHub Actions job timeout in minutes", (value) => Number(value))
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
    .command("artifact-init")
    .description("Create a browser task artifact workspace template.")
    .requiredOption("--task-id <id>", "lowercase id for the artifact workspace")
    .option("--title <text>", "human-readable task title")
    .option("--source <url-or-path>", "source URL or local route")
    .option("--out-dir <dir>", "output root for artifact workspaces", ".tmp/browser-task-artifacts")
    .addOption(new Option("--script-ext <ext>", "final script extension").choices(["ts", "js", "py"]).default("ts"))
    .action(async (options: { taskId: string; title?: string; source?: string; outDir: string; scriptExt: "ts" | "js" | "py" }) => {
      const result = await initBrowserTaskArtifact(options);
      console.log(`Created browser task artifact workspace: ${result.workspaceDir}`);
      for (const file of result.files) {
        console.log(`- ${file}`);
      }
      console.log("Next: fill task.md and plan.md, replace final_script, run from a clean start, then run artifact-check --strict.");
    });

  program
    .command("artifact-check")
    .description("Check a browser task artifact workspace.")
    .argument("<artifact-dir>", "artifact workspace directory")
    .option("--strict", "require verified status and concrete evidence")
    .action(async (artifactDir: string, options: { strict?: boolean }) => {
      const result = await checkBrowserTaskArtifact(artifactDir, { strict: options.strict });
      for (const check of result.checks) {
        const icon = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
        console.log(`[${icon}] ${check.name}: ${check.message}`);
      }
      if (result.checks.some((check) => check.status === "fail")) {
        process.exitCode = 1;
      }
    });

  program
    .command("artifact-run")
    .description("Run a browser task artifact final_script from its run directory.")
    .argument("<artifact-dir>", "artifact workspace directory")
    .argument("[scriptArgs...]", "arguments passed to final_script after --")
    .option("--run <run-id>", "run directory id under final_runs, such as run_001")
    .option("--script <path>", "script path, absolute or relative to the run directory")
    .option("--dry-run", "print the resolved command without running it")
    .action(async (artifactDir: string, scriptArgs: string[], options: { run?: string; script?: string; dryRun?: boolean }) => {
      const result = await runBrowserTaskArtifact({
        artifactDir,
        runId: options.run,
        script: options.script,
        dryRun: options.dryRun,
        args: scriptArgs,
      });
      console.log(`${result.dryRun ? "Would run" : "Ran"} artifact script in ${result.runDir}`);
      console.log(result.command.map(shellQuote).join(" "));
      if (!result.dryRun && result.exitCode !== 0) {
        process.exitCode = result.exitCode ?? 1;
      }
    });

  program
    .command("install-skill")
    .description("Install the bundled Codex or OpenClaw skill.")
    .argument("<target>", "codex | openclaw")
    .addOption(new Option("--skill <name>", "skill to install").choices(["smoke", "browser-task-artifact", "all"]).default("smoke"))
    .option("--dry-run", "print target path without copying files")
    .option("--force", "replace existing skill directory")
    .action(async (target: string, options: { skill: SkillSelection; dryRun?: boolean; force?: boolean }) => {
      if (!["codex", "openclaw"].includes(target)) {
        throw new Error(`Unsupported skill target: ${target}`);
      }
      const results = await installSkills({ target: target as SkillTarget, ...options });
      console.log(`${options.dryRun ? "Would install" : "Installed"} ${target} ${results.length === 1 ? "skill" : "skills"}`);
      for (const result of results) {
        console.log(`- from ${result.source}`);
        console.log(`- to ${result.destination}`);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`playwright-ui-smoke-kit: ${message}`);
  process.exit(1);
});
