import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packageManager = process.env.PACKAGE_MANAGER || "npm";
const monorepo = process.env.MONOREPO === "1";

function run(command, args, cwd, env = {}) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function runCapture(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

async function writeFixtureProject(dir) {
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `fixture-${packageManager}`,
        version: "0.0.0",
        private: true,
        scripts: {
          dev: "node tests/static-server.mjs",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    join(dir, "index.html"),
    "<!doctype html><title>Fixture</title><h1>Fixture Home</h1>\n",
    "utf8",
  );
}

function installTarball(packageManager, tarball, cwd) {
  switch (packageManager) {
    case "npm":
      run("npm", ["install", "-D", tarball], cwd);
      break;
    case "pnpm":
      run("pnpm", ["add", "-D", tarball], cwd);
      break;
    case "yarn":
      run("yarn", ["add", "-D", tarball], cwd);
      break;
    case "bun":
      run("bun", ["add", "-d", tarball], cwd);
      break;
    default:
      throw new Error(`Unsupported PACKAGE_MANAGER=${packageManager}`);
  }
}

function installChromium(packageManager, cwd) {
  const browserArgs = process.env.CI ? ["install", "--with-deps", "chromium"] : ["install", "chromium"];
  switch (packageManager) {
    case "npm":
      run("npx", ["playwright", ...browserArgs], cwd);
      break;
    case "pnpm":
      run("pnpm", ["exec", "playwright", ...browserArgs], cwd);
      break;
    case "yarn":
      run("yarn", ["playwright", ...browserArgs], cwd);
      break;
    case "bun":
      run("bunx", ["playwright", ...browserArgs], cwd);
      break;
  }
}

function runSmoke(packageManager, cwd) {
  switch (packageManager) {
    case "npm":
      run("npm", ["run", "smoke:web-ui"], cwd);
      break;
    case "pnpm":
      run("pnpm", ["run", "smoke:web-ui"], cwd);
      break;
    case "yarn":
      run("yarn", ["smoke:web-ui"], cwd);
      break;
    case "bun":
      run("bun", ["run", "smoke:web-ui"], cwd);
      break;
  }
}

const packDir = await mkdtemp(join(tmpdir(), "pusk-pack-"));
const repoRoot = await mkdtemp(join(tmpdir(), `pusk-${packageManager}-`));
const fixtureDir = monorepo ? join(repoRoot, "apps", "web") : repoRoot;

try {
  await mkdir(packDir, { recursive: true });
  const packOutput = runCapture("npm", ["pack", "--pack-destination", packDir], root)
    .trim()
    .split("\n")
    .at(-1);
  const actualTarball = join(packDir, packOutput);

  await mkdir(fixtureDir, { recursive: true });
  await writeFixtureProject(fixtureDir);
  installTarball(packageManager, actualTarball, fixtureDir);

  run("npx", [
    "playwright-ui-smoke-kit",
    "init",
    "--yes",
    "--template",
    "static-site",
    "--package-manager",
    packageManager,
    "--repo-root",
    repoRoot,
    "--app-dir",
    fixtureDir,
    "--route",
    "/::Fixture Home",
  ], fixtureDir);

  if (monorepo) {
    const workflow = await readFile(join(repoRoot, ".github", "workflows", "playwright-ui-smoke.yml"), "utf8");
    if (!workflow.includes("working-directory: apps/web")) {
      throw new Error("Monorepo workflow did not use apps/web working-directory");
    }
  }

  installChromium(packageManager, fixtureDir);
  runSmoke(packageManager, fixtureDir);
} finally {
  if (!process.env.KEEP_E2E_FIXTURES) {
    await rm(packDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept fixture: ${fixtureDir}`);
  }
}
