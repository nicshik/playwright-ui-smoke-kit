#!/usr/bin/env node
import { confirm, input, select } from "@inquirer/prompts";
import { Command, Option } from "commander";
import { commandsForPackageManager, detectPackageManager } from "./package-manager.js";
import { getTemplatePreset, templateNames } from "./presets.js";
import { initProject } from "./init.js";
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

  const template = await select<TemplateName>({
    message: "Project template",
    default: options.template ?? "vite-app",
    choices: templateNames.map((name) => ({ name, value: name })),
  });

  const preset = getTemplatePreset(template, packageManager);
  const webCommand = await input({
    message: "Web app command",
    default: options.webCommand ?? preset.webCommand,
  });
  const webPort = Number(
    await input({
      message: "Web app port",
      default: String(options.webPort ?? preset.webPort),
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
    .option("--app-dir <dir>", "directory with package.json", ".")
    .addOption(new Option("--template <name>", "template preset").choices(templateNames))
    .addOption(new Option("--package-manager <name>", "package manager").choices(["npm", "pnpm", "yarn", "bun"]))
    .option("--web-command <command>", "command that starts the web app")
    .option("--web-port <port>", "web app port", (value) => Number(value))
    .option("--api-command <command>", "optional API command")
    .option("--api-url <url>", "optional API health URL")
    .option("--route <route>", "repeatable route as /path::Visible marker", collect, [])
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

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`playwright-ui-smoke-kit: ${message}`);
  process.exit(1);
});
