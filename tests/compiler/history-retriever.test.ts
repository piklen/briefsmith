import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { retrievePromptEntries, retrievePromptSnippets } from "../../src/compiler/history-retriever.js";
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

test("retrievePromptEntries ignores generic substring matches from unrelated English prompts", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-history-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:irrelevant-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "Memory agent workflow for future checkout tasks. The goal is to help future agents fix similar tasks with fewer tool calls and better workflow summaries.",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-irrelevant-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    },
    {
      id: "codex:relevant-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-2",
      timestamp: "2026-04-19T10:01:00.000Z",
      promptText: "Fix checkout flow timeout without changing the payment API.",
      sourceFile: "/tmp/source2.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-relevant-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:01:00.000Z"
    }
  ]);

  const entries = retrievePromptEntries(repository, "fix this checkout flow");
  database.close();

  assert.deepEqual(entries.map((entry) => entry.id), ["codex:relevant-1"]);
});

test("retrievePromptEntries ignores long meta prompts that only share one informative token", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-history-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:irrelevant-2",
      tool: "codex",
      projectPath: root,
      sessionId: "session-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "You are a memory writing agent. For future checkout tasks, keep improving workflow summaries so other agents can fix similar tasks faster.",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-irrelevant-2",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);

  const entries = retrievePromptEntries(repository, "fix this checkout flow");
  database.close();

  assert.deepEqual(entries, []);
});

test("retrievePromptEntries can scope matches to the current project path", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-history-"));
  const database = new Database(join(root, "skill.db"));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:other-project-1",
      tool: "codex",
      projectPath: "/tmp/other-project",
      sessionId: "session-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "Fix checkout flow timeout without changing the payment API.",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-other-project-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);

  const entries = retrievePromptEntries(repository, "fix this checkout flow", 3, {
    projectPath: root
  });
  database.close();

  assert.deepEqual(entries, []);
});
