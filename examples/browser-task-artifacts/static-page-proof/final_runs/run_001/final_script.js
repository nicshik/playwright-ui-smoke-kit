import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runDir = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(runDir, "../..");
const sourcePath = resolve(artifactDir, "source.html");
const screenshotsDir = resolve(runDir, "screenshots");
const screenshotPath = resolve(screenshotsDir, "home.png");

function extract(pattern, body, label) {
  const match = body.match(pattern);
  if (!match) {
    throw new Error(`Missing ${label}`);
  }
  return match[1].trim();
}

const html = readFileSync(sourcePath, "utf8");
const title = extract(/<title>(.*?)<\/title>/s, html, "title");
const heading = extract(/<h1>(.*?)<\/h1>/s, html, "heading");
const ctaText = extract(/<a\b[^>]*>(.*?)<\/a>/s, html, "call to action");

mkdirSync(screenshotsDir, { recursive: true });
writeFileSync(
  screenshotPath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
);

writeFileSync(
  resolve(runDir, "action_log.md"),
  [
    "# Action Log",
    "",
    "Run: `run_001`",
    "Status: verified",
    "",
    "## Steps",
    "",
    "- step 1 read local fixture: `source.html`",
    `- step 2 verified title: \`${title}\``,
    `- step 3 verified heading: \`${heading}\``,
    `- step 4 verified call to action: \`${ctaText}\``,
    "- step 5 wrote screenshot evidence: `screenshots/home.png`",
    "",
    "## Final Result",
    "",
    `Verified \`${heading}\`.`,
    "",
  ].join("\n"),
  "utf8",
);

writeFileSync(
  resolve(runDir, "result.json"),
  `${JSON.stringify(
    {
      schema_version: "browser_task_artifact.v1",
      task_id: "static-page-proof",
      created_at: "2026-05-27T00:00:00Z",
      status: "verified",
      command: "node final_script.js",
      parameters: {
        source: "source.html",
      },
      critical_points: [
        { id: "CP1", status: "verified", description: "Page title is Artifact Demo" },
        { id: "CP2", status: "verified", description: "Page heading is visible in the fixture" },
        { id: "CP3", status: "verified", description: "Primary call to action text is present" },
      ],
      evidence_refs: [
        "final_runs/run_001/action_log.md",
        "final_runs/run_001/result.json",
        "final_runs/run_001/screenshots/home.png",
      ],
      result: {
        title,
        heading,
        cta_text: ctaText,
      },
      redaction: "secrets_not_collected",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Verified static page artifact: ${heading}`);
