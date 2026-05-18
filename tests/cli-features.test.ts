import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { addRouteToSpec } from "../src/add-route.js";
import { doctorProject } from "../src/doctor.js";
import { detectProjectDefaults } from "../src/framework.js";
import { initProject } from "../src/init.js";
import { installSkill } from "../src/skills.js";

async function tempProject(packageJson: Record<string, unknown> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "pusk-cli-"));
  await writeFile(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "fixture", version: "0.0.0", ...packageJson }, null, 2)}\n`,
    "utf8",
  );
  return dir;
}

describe("repo root and app dir", () => {
  test("writes GitHub workflow to repo root with app working directory", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "pusk-mono-"));
    const appDir = join(repoRoot, "apps", "web");
    await mkdir(appDir, { recursive: true });
    await writeFile(join(appDir, "package.json"), JSON.stringify({ name: "web" }), "utf8");

    await initProject({
      repoRoot,
      appDir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
    });

    const workflow = await readFile(join(repoRoot, ".github", "workflows", "playwright-ui-smoke.yml"), "utf8");
    expect(workflow).toContain("working-directory: apps/web");
    expect(workflow).toContain("cache-dependency-path: apps/web/package-lock.json");
    expect(workflow).toContain('"apps/web/**"');
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("timeout-minutes: 10");
  });

  test("passes workflow cost controls from init options", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "pusk-options-"));
    const appDir = join(repoRoot, "apps", "web");
    await mkdir(appDir, { recursive: true });
    await writeFile(join(appDir, "package.json"), JSON.stringify({ name: "web" }), "utf8");

    await initProject({
      repoRoot,
      appDir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
      baseBranch: "develop",
      workflowPath: ["packages/ui/**"],
      workflowTimeout: 12,
    });

    const workflow = await readFile(join(repoRoot, ".github", "workflows", "playwright-ui-smoke.yml"), "utf8");
    expect(workflow).toContain('- "develop"');
    expect(workflow).toContain('- "packages/ui/**"');
    expect(workflow).toContain("timeout-minutes: 12");
  });

  test("can disable workflow path filters from init options", async () => {
    const dir = await tempProject();
    await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
      workflowAllChanges: true,
    });

    const workflow = await readFile(join(dir, ".github", "workflows", "playwright-ui-smoke.yml"), "utf8");
    expect(workflow).not.toContain("paths:");
    expect(workflow).not.toContain("paths-ignore:");
  });

  test("renders env values through Playwright webServer.env", async () => {
    const dir = await tempProject();
    await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      template: "app-plus-api",
      routes: ["/::Home"],
      webEnv: ["FEATURE_FLAG=1"],
      apiEnv: ["API_MODE=test"],
    });

    const config = await readFile(join(dir, "playwright.config.ts"), "utf8");
    expect(config).toContain('"FEATURE_FLAG": "1"');
    expect(config).toContain('"PORT": "3001"');
    expect(config).toContain('"API_MODE": "test"');
  });
});

describe("framework detection", () => {
  test("detects Next.js", async () => {
    const dir = await tempProject({ dependencies: { next: "latest" } });
    await expect(detectProjectDefaults(dir, "npm")).resolves.toMatchObject({
      framework: "next",
      template: "next-app",
    });
  });

  test("detects Astro with Astro port", async () => {
    const dir = await tempProject({ devDependencies: { astro: "latest" } });
    await expect(detectProjectDefaults(dir, "npm")).resolves.toMatchObject({
      framework: "astro",
      webPort: 4321,
    });
  });
});

describe("add-route", () => {
  test("adds a route once", async () => {
    const dir = await tempProject();
    await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
    });

    const first = await addRouteToSpec({ appDir: dir, route: "/dashboard::Dashboard" });
    const second = await addRouteToSpec({ appDir: dir, route: "/dashboard::Dashboard" });
    const spec = await readFile(join(dir, "tests", "ui-smoke.spec.ts"), "utf8");

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(spec.match(/Dashboard/g)).toHaveLength(1);
  });
});

describe("doctor", () => {
  test("reports a healthy generated project", async () => {
    const dir = await tempProject();
    await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
    });

    const checks = await doctorProject({ repoRoot: dir, appDir: dir });
    expect(checks.some((check) => check.name === "playwright.config.ts" && check.status === "pass")).toBe(true);
    expect(checks.some((check) => check.name === "@playwright/test" && check.status === "pass")).toBe(true);
    expect(checks.filter((check) => check.status === "warn").map((check) => check.name)).not.toContain(
      "workflow trigger scope",
    );
    expect(checks.filter((check) => check.status === "warn").map((check) => check.name)).not.toContain(
      "workflow concurrency",
    );
    expect(checks.filter((check) => check.status === "warn").map((check) => check.name)).not.toContain(
      "workflow path filter",
    );
  });

  test("warns about older expensive GitHub Actions workflow shape", async () => {
    const dir = await tempProject({
      scripts: { "smoke:web-ui": "playwright test" },
      devDependencies: { "@playwright/test": "latest" },
    });
    await mkdir(join(dir, "tests"), { recursive: true });
    await mkdir(join(dir, ".github", "workflows"), { recursive: true });
    await writeFile(join(dir, "playwright.config.ts"), "export default {};\n", "utf8");
    await writeFile(join(dir, "tests", "ui-smoke.spec.ts"), "test('placeholder', () => {});\n", "utf8");
    await writeFile(
      join(dir, ".github", "workflows", "playwright-ui-smoke.yml"),
      `name: Playwright UI Smoke

on:
  push:
  pull_request:

jobs:
  playwright-ui-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 20
`,
      "utf8",
    );

    const checks = await doctorProject({ repoRoot: dir, appDir: dir });
    const warnings = checks.filter((check) => check.status === "warn").map((check) => check.name);

    expect(warnings).toContain("workflow trigger scope");
    expect(warnings).toContain("workflow concurrency");
    expect(warnings).toContain("workflow timeout");
    expect(warnings).toContain("workflow path filter");
  });
});

describe("skill installer", () => {
  test("resolves Codex target path in dry-run mode", async () => {
    const home = await mkdtemp(join(tmpdir(), "pusk-home-"));
    const previousHome = process.env.HOME;
    process.env.HOME = home;
    try {
      const result = await installSkill({ target: "codex", dryRun: true });
      expect(result.destination).toContain(".codex");
      expect(result.source).toContain("skills/codex/playwright-smoke-setup");
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
