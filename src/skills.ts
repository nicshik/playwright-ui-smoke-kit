import { cp, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type SkillTarget = "codex" | "openclaw";

export interface InstallSkillOptions {
  target: SkillTarget;
  dryRun?: boolean;
  force?: boolean;
}

const require = createRequire(import.meta.url);

function packageRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, ".."), path.resolve(here, "..", "..")];
  for (const candidate of candidates) {
    try {
      const packageJson = JSON.parse(
        // Sync read keeps this helper simple and deterministic for CLI startup.
        require("node:fs").readFileSync(path.join(candidate, "package.json"), "utf8"),
      ) as { name?: string };
      if (packageJson.name === "playwright-ui-smoke-kit") return candidate;
    } catch {
      // try next candidate
    }
  }
  return path.resolve(here, "..");
}

function skillPaths(target: SkillTarget) {
  const root = packageRoot();
  if (target === "codex") {
    return {
      source: path.join(root, "skills", "codex", "playwright-smoke-setup"),
      destination: path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills", "playwright-smoke-setup"),
    };
  }
  return {
    source: path.join(root, "skills", "openclaw", "playwright_ui_smoke_setup"),
    destination: path.join(os.homedir(), ".openclaw", "skills", "playwright_ui_smoke_setup"),
  };
}

export async function installSkill(options: InstallSkillOptions) {
  const paths = skillPaths(options.target);
  if (!existsSync(paths.source)) {
    throw new Error(`Bundled skill not found: ${paths.source}`);
  }
  if (existsSync(paths.destination) && !options.force) {
    throw new Error(`${paths.destination} already exists. Use --force to replace it.`);
  }

  if (!options.dryRun) {
    await mkdir(path.dirname(paths.destination), { recursive: true });
    await cp(paths.source, paths.destination, { recursive: true, force: Boolean(options.force) });
  }

  return paths;
}

export async function readSkillFrontmatter(filePath: string) {
  const body = await readFile(filePath, "utf8");
  const match = body.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${filePath}: missing YAML frontmatter`);
  return match[1] ?? "";
}
