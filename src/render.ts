import path from "node:path";
import { commandsForPackageManager, lockfileForPackageManager } from "./package-manager.js";
import type { PackageManager, RouteSpec, WebServerSpec } from "./types.js";

function quote(value: string) {
  return JSON.stringify(value);
}

function renderWebServer(server: WebServerSpec) {
  return `    {
      command: ${quote(server.command)},
      url: ${quote(server.url)},
      reuseExistingServer,
      timeout: 60_000,
    }`;
}

export function renderPlaywrightConfig(options: {
  baseURL: string;
  webServers: WebServerSpec[];
}) {
  return `import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: ${quote(options.baseURL)},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
${options.webServers.map(renderWebServer).join(",\n")}
  ],
});
`;
}

export function renderUiSmokeSpec(routes: RouteSpec[]) {
  const routeEntries = routes
    .map((route) => `  { path: ${quote(route.path)}, marker: ${quote(route.marker)} }`)
    .join(",\n");

  return `import { expect, test, type Page } from "@playwright/test";

const routes = [
${routeEntries},
];

function collectBrowserErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

test.describe("UI smoke", () => {
  for (const route of routes) {
    test(\`\${route.path} renders\`, async ({ page }) => {
      const browserErrors = collectBrowserErrors(page);

      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByText(route.marker, { exact: false })).toBeVisible();

      expect(browserErrors.pageErrors, \`Page errors on \${route.path}\`).toEqual([]);
      expect(browserErrors.consoleErrors, \`Console errors on \${route.path}\`).toEqual([]);
    });
  }
});
`;
}

function posixPath(value: string) {
  return value.split(path.sep).join(path.posix.sep);
}

function workflowPath(appDir: string, fileName: string) {
  const normalized = posixPath(appDir) || ".";
  return normalized === "." ? fileName : `${normalized}/${fileName}`;
}

export function renderGithubWorkflow(options: {
  appDir: string;
  packageManager: PackageManager;
}) {
  const manager = options.packageManager;
  const commands = commandsForPackageManager(manager);
  const appDir = posixPath(options.appDir || ".");
  const lockfile = workflowPath(appDir, lockfileForPackageManager(manager));
  const artifactPrefix = appDir === "." ? "" : `${appDir}/`;

  if (manager === "bun") {
    return `name: Playwright UI Smoke

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  playwright-ui-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    defaults:
      run:
        working-directory: ${appDir}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: ${commands.installFrozen}

      - name: Install Chromium for Playwright
        run: ${commands.playwrightInstall}

      - name: Run Playwright UI smoke
        run: ${commands.runSmoke}

      - name: Upload Playwright artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-ui-smoke-artifacts
          path: |
            ${artifactPrefix}playwright-report
            ${artifactPrefix}test-results
          if-no-files-found: ignore
          retention-days: 7
`;
  }

  const setupPackageManager =
    manager === "pnpm"
      ? `      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

`
      : manager === "yarn"
        ? `      - name: Enable Corepack
        run: corepack enable

`
        : "";

  const setupNodeCache = manager === "npm" ? "npm" : manager;

  return `name: Playwright UI Smoke

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  playwright-ui-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    defaults:
      run:
        working-directory: ${appDir}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

${setupPackageManager}      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: ${setupNodeCache}
          cache-dependency-path: ${lockfile}

      - name: Install dependencies
        run: ${commands.installFrozen}

      - name: Install Chromium for Playwright
        run: ${commands.playwrightInstall}

      - name: Run Playwright UI smoke
        run: ${commands.runSmoke}

      - name: Upload Playwright artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-ui-smoke-artifacts
          path: |
            ${artifactPrefix}playwright-report
            ${artifactPrefix}test-results
          if-no-files-found: ignore
          retention-days: 7
`;
}
