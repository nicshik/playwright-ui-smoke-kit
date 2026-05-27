import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { checkBrowserTaskArtifact, initBrowserTaskArtifact, runBrowserTaskArtifact } from "../src/artifact.js";

async function tempDir() {
  return mkdtemp(join(tmpdir(), "pusk-artifact-"));
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

  test("runs the latest artifact script with args from the run directory", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "run-proof", scriptExt: "js" });
    const secondRunDir = join(created.workspaceDir, "final_runs", "run_002");
    await mkdir(secondRunDir, { recursive: true });
    await writeFile(
      join(secondRunDir, "final_script.js"),
      [
        "import { writeFileSync } from 'node:fs';",
        "writeFileSync('run-output.json', JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));",
      ].join("\n"),
      "utf8",
    );

    const result = await runBrowserTaskArtifact({
      artifactDir: created.workspaceDir,
      args: ["--flag", "value"],
    });

    expect(result.runDir).toBe(secondRunDir);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(await readFile(join(secondRunDir, "run-output.json"), "utf8")) as { cwd: string; args: string[] };
    await expect(realpath(output.cwd)).resolves.toBe(await realpath(secondRunDir));
    expect(output.args).toEqual(["--flag", "value"]);
  });

  test("dry-runs artifact scripts without executing them", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "dry-run-proof", scriptExt: "js" });
    const outputPath = join(created.runDir, "should-not-exist.txt");
    await writeFile(join(created.runDir, "final_script.js"), "import { writeFileSync } from 'node:fs'; writeFileSync('should-not-exist.txt', 'ran');\n", "utf8");

    const result = await runBrowserTaskArtifact({
      artifactDir: created.workspaceDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.command).toContain(join(created.runDir, "final_script.js"));
    await expect(exists(outputPath)).resolves.toBe(false);
  });

  test("returns the final script exit code", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "failed-run-proof", scriptExt: "js" });
    await writeFile(join(created.runDir, "final_script.js"), "process.exit(7);\n", "utf8");

    const result = await runBrowserTaskArtifact({ artifactDir: created.workspaceDir });

    expect(result.exitCode).toBe(7);
  });

  test("requires --script when a run contains multiple final scripts", async () => {
    const outDir = await tempDir();
    const created = await initBrowserTaskArtifact({ outDir, taskId: "ambiguous-proof", scriptExt: "js" });
    await writeFile(join(created.runDir, "final_script.py"), "print('ambiguous')\n", "utf8");

    await expect(runBrowserTaskArtifact({ artifactDir: created.workspaceDir })).rejects.toThrow(/Multiple final scripts/);
    await expect(
      runBrowserTaskArtifact({
        artifactDir: created.workspaceDir,
        script: "final_script.js",
        dryRun: true,
      }),
    ).resolves.toMatchObject({ dryRun: true });
  });

  test("ships a strict verified browser task artifact example", async () => {
    const checked = await checkBrowserTaskArtifact("examples/browser-task-artifacts/static-page-proof", { strict: true });
    expect(checked.checks.filter((check) => check.status === "fail")).toEqual([]);
  });
});
