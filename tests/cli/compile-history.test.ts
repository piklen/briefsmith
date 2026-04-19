import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { globalDataDir, databasePath } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";

test("runCli compile latest prints the most recent compile session", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new CompileSessionRepository(database);

  repository.save({
    projectPath: process.cwd(),
    rawInput: "first compile",
    compiledPrompt: "Task Goal\nfirst compile",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: [],
    historySlotIds: {}
  });
  repository.save({
    projectPath: process.cwd(),
    rawInput: "second compile",
    compiledPrompt: "Task Goal\nsecond compile",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "superpowers",
    targetHost: "cli",
    usedHistoryIds: [],
    historySlotIds: {
      constraints: "codex:constraint-1"
    }
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["compile", "latest"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("second compile")), true);
  assert.equal(output.some((line) => line.includes("superpowers")), true);
  assert.equal(output.some((line) => line.includes("History Slot IDs: constraints=codex:constraint-1")), true);
});

test("runCli compile history lists recent compile sessions", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new CompileSessionRepository(database);

  repository.save({
    projectPath: process.cwd(),
    rawInput: "history compile one",
    compiledPrompt: "Task Goal\nhistory compile one",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: [],
    historySlotIds: {}
  });
  repository.save({
    projectPath: process.cwd(),
    rawInput: "history compile two",
    compiledPrompt: "Task Goal\nhistory compile two",
    followUpQuestions: [],
    resolvedSlots: {},
    targetFramework: "gstack",
    targetHost: "cli",
    usedHistoryIds: ["codex:1"],
    historySlotIds: {
      constraints: "codex:1"
    }
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["compile", "history"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("history compile one")), true);
  assert.equal(output.some((line) => line.includes("history compile two")), true);
  assert.equal(output.some((line) => line.includes("history compile two") && line.includes("history_slots=constraints")), true);
});

test("runCli compile show prints persisted history slot provenance", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const repository = new CompileSessionRepository(database);

  const session = repository.save({
    projectPath: process.cwd(),
    rawInput: "show compile",
    compiledPrompt: "Task Goal\nshow compile",
    followUpQuestions: [],
    resolvedSlots: {
      constraints: "keep API unchanged"
    },
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: ["codex:constraint-2"],
    historySlotIds: {
      constraints: "codex:constraint-2"
    }
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["compile", "show", session.id], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("Used History IDs: codex:constraint-2")), true);
  assert.equal(output.some((line) => line.includes("History Slot IDs: constraints=codex:constraint-2")), true);
});
