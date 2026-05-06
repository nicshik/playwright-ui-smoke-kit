import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { commandsForPackageManager, detectPackageManager, runPackageScript } from "../src/package-manager.js";

async function tempProject() {
  const dir = await mkdtemp(join(tmpdir(), "pusk-pm-"));
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
  return dir;
}

describe("package manager detection", () => {
  test("detects packageManager field before lock files", async () => {
    const dir = await tempProject();
    await writeFile(join(dir, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }), "utf8");
    await writeFile(join(dir, "package-lock.json"), "", "utf8");

    await expect(detectPackageManager(dir)).resolves.toBe("pnpm");
  });

  test("detects lock files", async () => {
    const dir = await tempProject();
    await writeFile(join(dir, "bun.lock"), "", "utf8");

    await expect(detectPackageManager(dir)).resolves.toBe("bun");
  });

  test("defaults to npm", async () => {
    const dir = await tempProject();

    await expect(detectPackageManager(dir)).resolves.toBe("npm");
  });
});

describe("package manager commands", () => {
  test("generates install and smoke commands for each supported manager", () => {
    expect(runPackageScript("npm", "smoke:web-ui")).toBe("npm run smoke:web-ui");
    expect(commandsForPackageManager("pnpm").playwrightInstall).toContain("pnpm exec playwright");
    expect(commandsForPackageManager("yarn").addDev).toBe("yarn add -D @playwright/test");
    expect(commandsForPackageManager("bun").installFrozen).toBe("bun install --frozen-lockfile");
  });
});
