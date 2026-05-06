import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
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

for (const skill of skills) {
  const fullPath = join(root, skill.file);
  const body = await readFile(fullPath, "utf8");
  const match = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error(`${skill.file}: missing YAML frontmatter`);
  }
  const frontmatter = match[1];
  if (!frontmatter.includes(`name: ${skill.expectedName}`)) {
    throw new Error(`${skill.file}: wrong name`);
  }
  if (!frontmatter.match(/^description:\s+\S/m)) {
    throw new Error(`${skill.file}: missing description`);
  }
}

console.log("Skill metadata looks valid.");
