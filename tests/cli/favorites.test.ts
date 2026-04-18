import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { globalDataDir, databasePath } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";

test("runCli favorites list prints only starred prompts", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new PromptRepository(database);

  repository.upsertMany([
    {
      id: "codex:starred",
      tool: "codex",
      projectPath: "/tmp/project",
      sessionId: "session-1",
      timestamp: "2026-04-19T12:00:00.000Z",
      promptText: "important prompt",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fav-fp-1",
      isFavorite: true,
      tags: [],
      importedAt: "2026-04-19T12:00:00.000Z"
    },
    {
      id: "codex:plain",
      tool: "codex",
      projectPath: "/tmp/project",
      sessionId: "session-2",
      timestamp: "2026-04-19T13:00:00.000Z",
      promptText: "plain prompt",
      sourceFile: "/tmp/source-2.jsonl",
      sourceOffset: 0,
      fingerprint: "fav-fp-2",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T13:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["favorites", "list"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("important prompt")), true);
  assert.equal(output.some((line) => line.includes("plain prompt")), false);
});
