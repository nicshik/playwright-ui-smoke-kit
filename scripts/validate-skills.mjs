import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

const root = new URL("..", import.meta.url).pathname;
const codexSkillDir = join(root, "skills/codex/playwright-smoke-setup");
const skills = [
  {
    file: "skills/codex/playwright-smoke-setup/SKILL.md",
    expectedName: "playwright-smoke-setup",
  },
  {
    file: "skills/openclaw/playwright_ui_smoke_setup/SKILL.md",
    expectedName: "playwright_ui_smoke_setup",
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(skillFile, body) {
  const match = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error(`${skillFile}: missing YAML frontmatter`);
  }
  return YAML.parse(match[1]);
}

for (const skill of skills) {
  const fullPath = join(root, skill.file);
  const body = await readFile(fullPath, "utf8");
  const frontmatter = parseFrontmatter(skill.file, body);
  if (frontmatter.name !== skill.expectedName) {
    throw new Error(`${skill.file}: wrong name`);
  }
  if (!frontmatter.description) {
    throw new Error(`${skill.file}: missing description`);
  }

  if (skill.expectedName === "playwright_ui_smoke_setup") {
    const bins = frontmatter.metadata?.openclaw?.requires?.bins;
    if (!Array.isArray(bins) || !bins.includes("node")) {
      throw new Error(`${skill.file}: missing metadata.openclaw.requires.bins: [node]`);
    }
  }
}

const quickValidateCandidates = [
  process.env.CODEX_SKILL_QUICK_VALIDATE,
  "/Users/nick/.codex/skills/.system/skill-creator/scripts/quick_validate.py",
].filter(Boolean);

for (const candidate of quickValidateCandidates) {
  if (await exists(candidate)) {
    const result = spawnSync("python3", [candidate, codexSkillDir], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`Codex quick_validate.py failed for ${codexSkillDir}`);
    }
    break;
  }
}

console.log("Skill metadata looks valid.");
