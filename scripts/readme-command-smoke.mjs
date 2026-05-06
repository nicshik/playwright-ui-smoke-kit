import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const packDir = await mkdtemp(join(tmpdir(), "pusk-readme-pack-"));
const projectDir = await mkdtemp(join(tmpdir(), "pusk-readme-"));

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function capture(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
    .trim()
    .split("\n")
    .at(-1);
}

try {
  await mkdir(packDir, { recursive: true });
  const tarball = capture("npm", ["pack", "--pack-destination", packDir], root);

  await writeFile(
    join(projectDir, "package.json"),
    JSON.stringify({ name: "readme-fixture", version: "0.0.0", private: true }, null, 2) + "\n",
  );
  await writeFile(join(projectDir, "index.html"), "<!doctype html><h1>Home</h1>\n");

  run("npm", ["install", "-D", join(packDir, tarball)], projectDir);
  run("npx", [
    "playwright-ui-smoke-kit",
    "init",
    "--yes",
    "--template",
    "static-site",
    "--route",
    "/::Home",
  ], projectDir);
  run("npx", ["playwright", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"], projectDir);
  run("npm", ["run", "smoke:web-ui"], projectDir);
} finally {
  if (!process.env.KEEP_E2E_FIXTURES) {
    await rm(packDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  } else {
    console.log(`Kept README fixture: ${projectDir}`);
  }
}
