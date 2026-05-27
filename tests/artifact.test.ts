import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { checkBrowserTaskArtifact, initBrowserTaskArtifact } from "../src/artifact.js";

async function tempDir() {
  return mkdtemp(join(tmpdir(), "pusk-artifact-"));
}

describe("browser task artifacts", () => {
  test("creates a draft browser task artifact workspace", async () => {
    const outDir = await tempDir();
    const result = await initBrowserTaskArtifact({
      outDir,
      taskId: "customer-flow-proof",
      title: "Customer flow proof",
      source: "http://127.0.0.1:5173/customer",
      scriptExt: "ts",
    });

    await expect(readFile(join(result.workspaceDir, "task.md"), "utf8")).resolves.toContain("Customer flow proof");
    await expect(readFile(join(result.workspaceDir, "plan.md"), "utf8")).resolves.toContain("Critical Points");
    await expect(readFile(join(result.runDir, "final_script.ts"), "utf8")).resolves.toContain("Draft browser task artifact script");

    const parsed = JSON.parse(await readFile(join(result.runDir, "result.json"), "utf8")) as {
      schema_version: string;
      task_id: string;
      status: string;
    };
    expect(parsed.schema_version).toBe("browser_task_artifact.v1");
    expect(parsed.task_id).toBe("customer-flow-proof");
    expect(parsed.status).toBe("draft");
  });

  test("checks draft artifacts with warning in default mode and failure in strict mode", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "draft-proof" });

    const draft = await checkBrowserTaskArtifact(created.workspaceDir);
    expect(draft.checks.some((check) => check.status === "fail")).toBe(false);
    expect(draft.checks.some((check) => check.status === "warn" && check.name === "verification.md")).toBe(true);

    const strict = await checkBrowserTaskArtifact(created.workspaceDir, { strict: true });
    expect(strict.checks.some((check) => check.status === "fail" && check.name === "result.json")).toBe(true);
    expect(strict.checks.some((check) => check.status === "fail" && check.name === "screenshots")).toBe(true);
  });

  test("passes strict mode for a verified artifact", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "verified-proof", scriptExt: "js" });
    await writeFile(
      join(created.runDir, "result.json"),
      `${JSON.stringify({
        schema_version: "browser_task_artifact.v1",
        task_id: "verified-proof",
        created_at: "2026-05-27T00:00:00Z",
        status: "verified",
        command: "node final_script.js",
        parameters: {},
        critical_points: [{ id: "CP1", status: "verified" }],
        evidence_refs: ["screenshots/final.png"],
        result: { ok: true },
        redaction: "secrets_not_collected",
      }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(created.workspaceDir, "verification.md"),
      [
        "# Verification",
        "",
        "| Critical point | Evidence | Status |",
        "|---|---|---|",
        "| CP1 | screenshots/final.png | verified |",
      ].join("\n"),
      "utf8",
    );
    await writeFile(join(created.runDir, "screenshots", "final.png"), "placeholder", "utf8");

    const checked = await checkBrowserTaskArtifact(created.workspaceDir, { strict: true });
    expect(checked.checks.filter((check) => check.status === "fail")).toEqual([]);
  });
});
