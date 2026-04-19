import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";

test("CompileSessionRepository saves and returns latest compile session", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-compile-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new CompileSessionRepository(database);

  repository.save({
    projectPath: root,
    rawInput: "optimize importer",
    compiledPrompt: "Task Goal\noptimize importer",
    followUpQuestions: ["what is the target?"],
    resolvedSlots: {
      constraints: "keep API unchanged"
    },
    targetFramework: "superpowers",
    targetHost: "cli",
    usedHistoryIds: ["codex:123"],
    historySlotIds: {
      constraints: "codex:123"
    }
  });

  const latest = repository.latest();
  database.close();

  assert.notEqual(latest, null);
  assert.equal(latest?.rawInput, "optimize importer");
  assert.deepEqual(latest?.usedHistoryIds, ["codex:123"]);
  assert.deepEqual(latest?.historySlotIds, {
    constraints: "codex:123"
  });
  assert.equal(latest?.targetFramework, "superpowers");
});

test("CompileSessionRepository can return the latest session for a specific project", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-compile-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new CompileSessionRepository(database);

  repository.save({
    rawInput: "optimize importer",
    compiledPrompt: "Task Goal\noptimize importer",
    followUpQuestions: [],
    resolvedSlots: {
      target: "importer"
    },
    projectPath: "/tmp/project-a",
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: []
  });

  repository.save({
    rawInput: "optimize checkout",
    compiledPrompt: "Task Goal\noptimize checkout",
    followUpQuestions: [],
    resolvedSlots: {
      target: "checkout flow"
    },
    projectPath: "/tmp/project-b",
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: []
  });

  const latest = repository.latestForProject("/tmp/project-a");
  database.close();

  assert.notEqual(latest, null);
  assert.equal(latest?.projectPath, "/tmp/project-a");
  assert.equal(latest?.resolvedSlots.target, "importer");
  assert.deepEqual(latest?.historySlotIds, {});
});
