import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";

test("CompileSessionRepository list returns newest-first sessions", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-compile-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new CompileSessionRepository(database);

  const first = repository.save({
    projectPath: root,
    rawInput: "first",
    compiledPrompt: "Task Goal\nfirst",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: []
  });
  const second = repository.save({
    projectPath: root,
    rawInput: "second",
    compiledPrompt: "Task Goal\nsecond",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: []
  });

  const list = repository.list();
  const fetched = repository.getById(second.id);
  database.close();

  assert.equal(list[0]?.id, second.id);
  assert.equal(list[1]?.id, first.id);
  assert.equal(fetched?.rawInput, "second");
});
