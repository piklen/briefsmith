import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";

test("runCli policy show prints the effective project policy", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-policy-cli-"));
  const output: string[] = [];

  const exitCode = await runCli(["policy", "show"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    enabled: boolean;
    mode: string;
    hostConfidenceThresholds: Record<string, number>;
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.enabled, true);
  assert.equal(payload.mode, "suggest");
  assert.equal(payload.hostConfidenceThresholds.codex, 0.7);
});

test("runCli policy mode and threshold update project config", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-policy-cli-"));

  let output: string[] = [];
  let exitCode = await runCli(["policy", "mode", "auto-compile"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });
  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("auto-compile")), true);

  output = [];
  exitCode = await runCli(["policy", "threshold", "codex", "0.62"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });
  assert.equal(exitCode, 0);

  output = [];
  exitCode = await runCli(["policy", "threshold", "codex", "success_criteria", "0.58"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });
  assert.equal(exitCode, 0);

  output = [];
  exitCode = await runCli(["policy", "threshold", "codex", "verification", "0.64"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });
  assert.equal(exitCode, 0);

  output = [];
  exitCode = await runCli(["policy", "show"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    mode: string;
    hostConfidenceThresholds: Record<string, number>;
    hostSlotConfidenceThresholds: Record<string, Record<string, number>>;
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.mode, "auto-compile");
  assert.equal(payload.hostConfidenceThresholds.codex, 0.62);
  assert.equal(payload.hostSlotConfidenceThresholds.codex.target, 0.62);
  assert.equal(payload.hostSlotConfidenceThresholds.codex.success_criteria, 0.58);
  assert.equal(payload.hostSlotConfidenceThresholds.codex.verification, 0.64);
  assert.equal(payload.hostSlotConfidenceThresholds.codex.constraints, 0.62);
});
