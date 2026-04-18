import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../src/storage/database.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";

test("PromptRepository.getById returns normalized prompt fields only", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-repo-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:test",
      tool: "codex",
      projectPath: "/tmp/project",
      sessionId: "session-1",
      timestamp: "2026-04-18T12:00:00.000Z",
      promptText: "hello",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fingerprint-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-18T12:00:00.000Z"
    }
  ]);

  const prompt = repository.getById("codex:test");

  assert.notEqual(prompt, null);
  assert.equal("tagsJson" in (prompt as object), false);
  assert.deepEqual(prompt?.tags, []);
  database.close();
});
