import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packageManager = process.env.PACKAGE_MANAGER || "npm";

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
          dev: "node server.mjs",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    join(dir, "server.mjs"),
    `import http from "node:http";

const port = Number(process.env.PORT || 4173);
const server = http.createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end("<!doctype html><title>Fixture</title><h1>Fixture Home</h1>");
});

server.listen(port, "127.0.0.1", () => {
  console.log(\`fixture server listening on \${port}\`);
});
`,
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
  switch (packageManager) {
    case "npm":
      run("npx", ["playwright", "install", "chromium"], cwd);
      break;
    case "pnpm":
      run("pnpm", ["exec", "playwright", "install", "chromium"], cwd);
      break;
    case "yarn":
      run("yarn", ["playwright", "install", "chromium"], cwd);
      break;
    case "bun":
      run("bunx", ["playwright", "install", "chromium"], cwd);
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
const fixtureDir = await mkdtemp(join(tmpdir(), `pusk-${packageManager}-`));

try {
  await mkdir(packDir, { recursive: true });
  const packOutput = runCapture("npm", ["pack", "--pack-destination", packDir], root)
    .trim()
    .split("\n")
    .at(-1);
  const actualTarball = join(packDir, packOutput);

  await writeFixtureProject(fixtureDir);
  installTarball(packageManager, actualTarball, fixtureDir);

  run("node", [
    join(fixtureDir, "node_modules", "playwright-ui-smoke-kit", "dist", "cli.js"),
    "init",
    "--yes",
    "--template",
    "static-site",
    "--package-manager",
    packageManager,
    "--web-command",
    "node server.mjs",
    "--web-port",
    "4173",
    "--route",
    "/::Fixture Home",
    "--ci",
    "none",
  ], fixtureDir);

  installChromium(packageManager, fixtureDir);
  runSmoke(packageManager, fixtureDir);
} finally {
  if (!process.env.KEEP_E2E_FIXTURES) {
    await rm(packDir, { recursive: true, force: true });
    await rm(fixtureDir, { recursive: true, force: true });
  } else {
    console.log(`Kept fixture: ${fixtureDir}`);
  }
}
