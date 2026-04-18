import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { globalDataDir, databasePath } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";
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
