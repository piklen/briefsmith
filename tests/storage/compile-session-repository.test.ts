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
    rawInput: "optimize importer",
    compiledPrompt: "Task Goal\noptimize importer",
    followUpQuestions: ["what is the target?"],
    resolvedSlots: {
      constraints: "keep API unchanged"
    },
    targetFramework: "superpowers",
    targetHost: "cli",
    usedHistoryIds: ["codex:123"]
  });

  const latest = repository.latest();
  database.close();

  assert.notEqual(latest, null);
  assert.equal(latest?.rawInput, "optimize importer");
  assert.deepEqual(latest?.usedHistoryIds, ["codex:123"]);
  assert.equal(latest?.targetFramework, "superpowers");
});
