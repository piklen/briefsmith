import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startPromptChecks, stopPromptChecks } from "../../src/cli/commands/policy.js";
import { readProjectPolicy } from "../../src/config/project-policy.js";

test("readProjectPolicy returns default confidence thresholds when config is missing", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-policy-"));

  const policy = await readProjectPolicy(root);

  assert.equal(policy.enabled, true);
  assert.equal(policy.mode, "suggest");
  assert.equal(policy.hostConfidenceThresholds.codex, 0.7);
  assert.equal(policy.hostConfidenceThresholds.opencode, 0.75);
  assert.equal(policy.hostSlotConfidenceThresholds.codex.success_criteria, 0.7);
  assert.equal(policy.hostSlotConfidenceThresholds.opencode.success_criteria, 0.75);
});

test("stop and start prompt checks preserve custom host confidence thresholds", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-policy-"));
  const policyPath = join(root, ".prompt-skill", "config.json");

  await stopPromptChecks(root);
  let policy = JSON.parse(readFileSync(policyPath, "utf8")) as {
    enabled: boolean;
    mode: string;
    hostConfidenceThresholds: Record<string, number>;
    hostSlotConfidenceThresholds: Record<string, Record<string, number>>;
  };
  assert.equal(policy.enabled, false);
  assert.equal(policy.mode, "off");
  assert.equal(policy.hostConfidenceThresholds.codex, 0.7);
  assert.equal(policy.hostSlotConfidenceThresholds.codex.success_criteria, 0.7);

  policy.hostConfidenceThresholds.codex = 0.61;
  policy.hostConfidenceThresholds.opencode = 0.8;
  policy.hostConfidenceThresholds.claude = 0.5;
  policy.hostSlotConfidenceThresholds.codex.success_criteria = 0.58;
  writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

  await startPromptChecks(root);
  policy = JSON.parse(readFileSync(policyPath, "utf8")) as {
    enabled: boolean;
    mode: string;
    hostConfidenceThresholds: Record<string, number>;
    hostSlotConfidenceThresholds: Record<string, Record<string, number>>;
  };

  assert.equal(policy.enabled, true);
  assert.equal(policy.mode, "suggest");
  assert.equal(policy.hostConfidenceThresholds.codex, 0.61);
  assert.equal(policy.hostConfidenceThresholds.opencode, 0.8);
  assert.equal(policy.hostConfidenceThresholds.claude, 0.5);
  assert.equal(policy.hostSlotConfidenceThresholds.codex.success_criteria, 0.58);
});
