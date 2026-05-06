import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { initProject } from "../src/init.js";

async function tempProject(packageJson: Record<string, unknown> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "pusk-init-"));
  await writeFile(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "fixture", version: "0.0.0", ...packageJson }, null, 2)}\n`,
    "utf8",
  );
  return dir;
}

describe("initProject", () => {
  test("generates files and updates package.json", async () => {
    const dir = await tempProject();

    const result = await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      skipInstall: true,
      template: "static-site",
      packageManager: "npm",
      routes: ["/::Fixture Home"],
      webCommand: "node server.mjs",
      webPort: 4173,
    });

    expect(result.files.map((file) => file.replace(dir, ""))).toEqual([
      "/playwright.config.ts",
      "/tests/ui-smoke.spec.ts",
      "/tests/static-server.mjs",
      "/.github/workflows/playwright-ui-smoke.yml",
    ]);

    await expect(readFile(join(dir, "playwright.config.ts"), "utf8")).resolves.toContain(
      'baseURL: "http://127.0.0.1:4173"',
    );
    await expect(readFile(join(dir, "tests", "ui-smoke.spec.ts"), "utf8")).resolves.toContain(
      "Fixture Home",
    );

    const packageJson = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.scripts["smoke:web-ui"]).toBe("playwright test");
    expect(packageJson.devDependencies["@playwright/test"]).toBeDefined();
  });

  test("dry-run does not write files", async () => {
    const dir = await tempProject();

    const result = await initProject({
      repoRoot: dir,
      appDir: dir,
      yes: true,
      dryRun: true,
      skipInstall: true,
      packageManager: "npm",
      routes: ["/::Home"],
    });

    expect(result.dryRun).toBe(true);
    await expect(readFile(join(dir, "playwright.config.ts"), "utf8")).rejects.toThrow();
  });

  test("refuses to overwrite generated files without force", async () => {
    const dir = await tempProject();
    await writeFile(join(dir, "playwright.config.ts"), "existing", "utf8");

    await expect(
      initProject({
        repoRoot: dir,
        appDir: dir,
        yes: true,
        skipInstall: true,
        packageManager: "npm",
        routes: ["/::Home"],
      }),
    ).rejects.toThrow(/already exists/);
  });

  test("refuses to replace an existing smoke script without force", async () => {
    const dir = await tempProject({ scripts: { "smoke:web-ui": "custom command" } });

    await expect(
      initProject({
        repoRoot: dir,
        appDir: dir,
        yes: true,
        skipInstall: true,
        packageManager: "npm",
        routes: ["/::Home"],
      }),
    ).rejects.toThrow(/different "smoke:web-ui"/);
  });
});
