import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { globalDataDir, databasePath } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";

test("runCli tags add attaches a tag to a prompt", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:test-tag",
      tool: "codex",
      projectPath: "/tmp/project",
      sessionId: "session-1",
      timestamp: "2026-04-19T12:00:00.000Z",
      promptText: "find a previous prompt",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "tag-fp-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T12:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["tags", "add", "codex:test-tag", "favorite-idea"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const verifyRepository = new PromptRepository(verifyDatabase);
  const prompt = verifyRepository.getById("codex:test-tag");
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("favorite-idea")), true);
  assert.deepEqual(prompt?.tags, ["favorite-idea"]);
});

test("runCli tags list prints the tags for a prompt", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:test-tags-list",
      tool: "codex",
      projectPath: "/tmp/project",
      sessionId: "session-1",
      timestamp: "2026-04-19T12:00:00.000Z",
      promptText: "find a previous prompt",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "tag-fp-2",
      isFavorite: false,
      tags: ["memory", "importer"],
      importedAt: "2026-04-19T12:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["tags", "list", "codex:test-tags-list"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("memory")), true);
  assert.equal(output.some((line) => line.includes("importer")), true);
});
