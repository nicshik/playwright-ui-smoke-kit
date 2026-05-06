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
      const parsed = parse(workflow) as Record<string, unknown>;

      expect(parsed.name).toBe("Playwright UI Smoke");
      expect(workflow).toContain("Run Playwright UI smoke");
      expect(workflow).toContain("smoke:web-ui");
    }
  });
});
