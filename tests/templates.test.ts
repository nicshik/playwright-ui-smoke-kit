import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { getTemplatePreset, templateNames } from "../src/presets.js";
import { renderGithubWorkflow, renderPlaywrightConfig, renderUiSmokeSpec } from "../src/render.js";

describe("template rendering", () => {
  test("renders every preset into Playwright files", () => {
    for (const template of templateNames) {
      const preset = getTemplatePreset(template, "npm");
      const config = renderPlaywrightConfig({
        baseURL: `http://127.0.0.1:${preset.webPort}`,
        testDir: "./tests",
        webServers: [{ command: preset.webCommand, url: `http://127.0.0.1:${preset.webPort}/` }],
      });
      const spec = renderUiSmokeSpec(preset.routes);

      expect(config).toContain("chromium");
      expect(config).toContain("reuseExistingServer");
      expect(spec).toContain("consoleErrors");
      expect(spec).toContain(preset.routes[0]?.marker);
    }
  });

  test("renders parseable GitHub workflow for each package manager", () => {
    for (const packageManager of ["npm", "pnpm", "yarn", "bun"] as const) {
      const workflow = renderGithubWorkflow({ appDir: ".", packageManager, scriptName: "smoke:web-ui" });
      const parsed = parse(workflow) as {
        name: string;
        on: {
          push: { branches: string[]; "paths-ignore"?: string[] };
          pull_request: { branches: string[]; "paths-ignore"?: string[] };
          workflow_dispatch: unknown;
        };
        concurrency: unknown;
        jobs: { "playwright-ui-smoke": { "timeout-minutes": number } };
      };

      expect(parsed.name).toBe("Playwright UI Smoke");
      expect(parsed.on.workflow_dispatch).toBeNull();
      expect(parsed.on.push.branches).toEqual(["main"]);
      expect(parsed.on.pull_request.branches).toEqual(["main"]);
      expect(parsed.on.push["paths-ignore"]).toContain("docs/**");
      expect(parsed.on.push["paths-ignore"]).toContain("**/*.md");
      expect(parsed.concurrency).toBeDefined();
      expect(parsed.jobs["playwright-ui-smoke"]["timeout-minutes"]).toBe(10);
      expect(workflow).toContain("Run Playwright UI smoke");
      expect(workflow).toContain("smoke:web-ui");
    }
  });

  test("renders monorepo workflow paths and shared path overrides", () => {
    const workflow = renderGithubWorkflow({
      appDir: "apps/web",
      packageManager: "npm",
      scriptName: "smoke:web-ui",
      workflowName: "playwright-ui-smoke.yml",
      workflowPaths: ["packages/ui/**"],
      baseBranch: "develop",
      workflowTimeout: 12,
    });
    const parsed = parse(workflow) as {
      on: { push: { branches: string[]; paths?: string[]; "paths-ignore"?: string[] } };
      jobs: { "playwright-ui-smoke": { "timeout-minutes": number } };
    };

    expect(parsed.on.push.branches).toEqual(["develop"]);
    expect(parsed.on.push.paths).toEqual([
      "apps/web/**",
      ".github/workflows/playwright-ui-smoke.yml",
      "apps/web/package.json",
      "apps/web/package-lock.json",
      "packages/ui/**",
    ]);
    expect(parsed.on.push["paths-ignore"]).toBeUndefined();
    expect(parsed.jobs["playwright-ui-smoke"]["timeout-minutes"]).toBe(12);
  });

  test("can render workflow for all changed files", () => {
    const workflow = renderGithubWorkflow({
      appDir: "apps/web",
      packageManager: "pnpm",
      scriptName: "smoke:web-ui",
      workflowAllChanges: true,
    });
    const parsed = parse(workflow) as {
      on: { push: { paths?: string[]; "paths-ignore"?: string[] } };
    };

    expect(parsed.on.push.paths).toBeUndefined();
    expect(parsed.on.push["paths-ignore"]).toBeUndefined();
  });
});
