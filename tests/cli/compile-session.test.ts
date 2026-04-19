import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { globalDataDir, databasePath } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";
import { ProfileRepository } from "../../src/storage/profile-repository.js";

test("runCli compile persists the latest compile session", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const profileRepository = new ProfileRepository(database);
  profileRepository.save({
    scope: "global",
    confirmed: {},
    inferred: {
      preferred_language: "zh-CN"
    },
    signals: {},
    updatedAt: "2026-04-19T10:00:00.000Z"
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(
    ["compile", "优化这个导入逻辑，提升可读性，并且不要改变外部命令行为，输出任务说明"],
    {
      cwd: process.cwd(),
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    }
  );

  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const compileSessionRepository = new CompileSessionRepository(verifyDatabase);
  const latest = compileSessionRepository.latest();
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("Task Goal")), true);
  assert.notEqual(latest, null);
  assert.equal(latest?.rawInput.includes("优化这个导入逻辑"), true);
});

test("runCli compile uses same-project continuation context without attaching trivial history matches", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const compileSessionRepository = new CompileSessionRepository(database);
  const promptRepository = new PromptRepository(database);

  compileSessionRepository.save({
    projectPath: root,
    rawInput: "优化这个导入逻辑，保持外部命令行为不变，并运行相关测试验证",
    compiledPrompt: "Task Goal\n优化这个导入逻辑",
    followUpQuestions: [],
    resolvedSlots: {
      target: "导入逻辑",
      constraints: "不要改变外部命令行为",
      verification: "运行相关测试验证"
    },
    targetFramework: "plain",
    targetHost: "cli",
    usedHistoryIds: []
  });

  promptRepository.upsertMany([
    {
      id: "codex:continuation-history-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-continuation-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "继续优化",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-continuation-history-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["compile", "继续优化"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const latest = new CompileSessionRepository(verifyDatabase).latest();
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("导入逻辑")), true);
  assert.deepEqual(latest?.usedHistoryIds, []);
  assert.equal(latest?.compiledPrompt.includes("Relevant Prompt Memory\n- none"), true);
});

test("runCli compile does not persist matched history when no slot resolves from it", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:meta-history-compile-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-meta-compile-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "帮我优化这个导入逻辑，如果不能那需要让ai去问用户。",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-meta-history-compile-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);
  profileRepository.save({
    scope: "global",
    confirmed: {},
    inferred: {
      preferred_language: "zh-CN"
    },
    signals: {},
    updatedAt: "2026-04-19T10:00:00.000Z"
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(
    ["compile", "帮我优化这个导入逻辑，保持外部命令行为不变，并运行相关测试验证"],
    {
      cwd: root,
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    }
  );

  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const latest = new CompileSessionRepository(verifyDatabase).latest();
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.deepEqual(latest?.usedHistoryIds, []);
  assert.equal(latest?.compiledPrompt.includes("Relevant Prompt Memory\n- none"), true);
  assert.equal(output.some((line) => line.includes("Relevant Prompt Memory\n- none")), true);
});

test("runCli compile persists only the exact history entry that resolved a slot", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:meta-history-compile-2",
      tool: "codex",
      projectPath: root,
      sessionId: "session-meta-compile-2",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化一下这个导入逻辑，如果不能那需要让ai去问用户。",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-meta-history-compile-2",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    },
    {
      id: "codex:constraint-history-compile-2",
      tool: "codex",
      projectPath: root,
      sessionId: "session-constraint-compile-2",
      timestamp: "2026-04-19T10:00:01.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 1,
      fingerprint: "fp-constraint-history-compile-2",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:01.000Z"
    }
  ]);
  profileRepository.save({
    scope: "global",
    confirmed: {},
    inferred: {
      preferred_language: "zh-CN"
    },
    signals: {},
    updatedAt: "2026-04-19T10:00:00.000Z"
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["compile", "优化一下这个导入逻辑"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const latest = new CompileSessionRepository(verifyDatabase).latest();
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.deepEqual(latest?.usedHistoryIds, ["codex:constraint-history-compile-2"]);
  assert.equal(latest?.compiledPrompt.includes("优化导入逻辑并保持外部命令行为不变"), true);
  assert.equal(latest?.compiledPrompt.includes("如果不能那需要让ai去问用户"), false);
});
