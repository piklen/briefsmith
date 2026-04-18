import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { retrievePromptSnippets } from "../../src/compiler/history-retriever.js";
import { Database } from "../../src/storage/database.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";

test("retrievePromptSnippets falls back to normalized keywords for fuzzy prompt lookups", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-history-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:history-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-history-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);

  const snippets = retrievePromptSnippets(repository, "优化一下这个导入逻辑");
  database.close();

  assert.deepEqual(snippets, ["优化导入逻辑并保持外部命令行为不变"]);
});
