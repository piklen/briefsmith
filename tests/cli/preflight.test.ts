import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";
import { databasePath, globalDataDir } from "../../src/config/paths.js";
import { Database } from "../../src/storage/database.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";
import { ProfileRepository } from "../../src/storage/profile-repository.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";

test("runCli preflight keeps low-confidence slots as compile for cli host", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:history-1",
      tool: "codex",
      projectPath: process.cwd(),
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
  const exitCode = await runCli(["preflight", "优化一下这个导入逻辑", "--host", "cli", "--json"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    host: string;
    compiledPrompt: string;
    usedHistoryIds: string[];
    resolvedSlots: Record<string, string>;
    evidence: {
      initialMissingSlots: string[];
      unresolvedSlots: string[];
      lowConfidenceSlots: string[];
      confidenceThreshold: number;
      historyMatchCount: number;
      resolvedSlotSources: Record<string, string>;
      resolvedSlotConfidence: Record<string, number>;
      historyMatches: Array<{
        id: string;
        tool: string;
        preview: string;
      }>;
    };
  };
  const verifyDatabase = new Database(databasePath(globalDataDir(homeDir)));
  const latest = new CompileSessionRepository(verifyDatabase).latest();
  verifyDatabase.close();

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.equal(payload.host, "cli");
  assert.equal(payload.compiledPrompt.includes("外部行为"), true);
  assert.deepEqual(payload.usedHistoryIds, ["codex:history-1"]);
  assert.deepEqual(payload.evidence.initialMissingSlots, ["target", "success_criteria", "constraints"]);
  assert.deepEqual(payload.evidence.unresolvedSlots, []);
  assert.deepEqual(payload.evidence.lowConfidenceSlots, []);
  assert.equal(payload.evidence.confidenceThreshold, 0);
  assert.equal(payload.evidence.historyMatchCount, 1);
  assert.deepEqual(payload.evidence.historyMatches, [
    {
      id: "codex:history-1",
      tool: "codex",
      preview: "优化导入逻辑并保持外部命令行为不变"
    }
  ]);
  assert.equal(payload.evidence.resolvedSlotConfidence.target, 0.96);
  assert.equal(payload.evidence.resolvedSlotConfidence.success_criteria, 0.68);
  assert.equal(payload.evidence.resolvedSlotConfidence.constraints, 0.82);
  assert.equal(payload.evidence.resolvedSlotSources.target, "input");
  assert.equal(payload.evidence.resolvedSlotSources.success_criteria, "heuristic");
  assert.equal(payload.evidence.resolvedSlotSources.constraints, "history");
  assert.equal(latest?.targetHost, "cli");
  assert.equal(latest?.resolvedSlots.constraints?.includes("外部行为"), true);
});

test("runCli preflight asks for low-confidence slots on codex host", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:history-2",
      tool: "codex",
      projectPath: process.cwd(),
      sessionId: "session-2",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-history-2",
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
  const exitCode = await runCli(["preflight", "优化一下这个导入逻辑", "--host", "codex", "--json"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    host: string;
    questions: string[];
    evidence: {
      lowConfidenceSlots: string[];
      confidenceThreshold: number;
      resolvedSlotConfidence: Record<string, number>;
      unresolvedSlots: string[];
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.equal(payload.host, "codex");
  assert.deepEqual(payload.evidence.unresolvedSlots, []);
  assert.deepEqual(payload.evidence.lowConfidenceSlots, ["success_criteria"]);
  assert.equal(payload.evidence.confidenceThreshold, 0.7);
  assert.equal(payload.evidence.resolvedSlotConfidence.success_criteria, 0.68);
  assert.equal(payload.questions.some((question) => question.includes("成功标准")), true);
});

test("runCli preflight returns ask action for low-information input", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const output: string[] = [];

  const exitCode = await runCli(["preflight", "优化一下", "--host", "opencode", "--json"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    host: string;
    questions: string[];
    evidence: {
      initialMissingSlots: string[];
      unresolvedSlots: string[];
      lowConfidenceSlots: string[];
      confidenceThreshold: number;
      historyMatchCount: number;
      resolvedSlotSources: Record<string, string>;
      resolvedSlotConfidence: Record<string, number>;
      historyMatches: Array<{
        id: string;
        tool: string;
        preview: string;
      }>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.equal(payload.host, "opencode");
  assert.equal(payload.questions.some((question) => question.includes("具体要处理")), true);
  assert.equal(payload.questions.some((question) => question.includes("成功标准")), true);
  assert.deepEqual(payload.evidence.initialMissingSlots, ["target", "success_criteria", "constraints"]);
  assert.deepEqual(payload.evidence.unresolvedSlots, ["target", "constraints"]);
  assert.deepEqual(payload.evidence.lowConfidenceSlots, ["success_criteria"]);
  assert.equal(payload.evidence.confidenceThreshold, 0.75);
  assert.equal(payload.evidence.historyMatchCount, 0);
  assert.deepEqual(payload.evidence.historyMatches, []);
  assert.equal(payload.evidence.resolvedSlotConfidence.success_criteria, 0.68);
  assert.equal(payload.evidence.resolvedSlotSources.success_criteria, "heuristic");
});

test("runCli preflight respects project-level confidence threshold overrides", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const promptSkillDir = join(root, ".prompt-skill");
  mkdirSync(promptSkillDir, { recursive: true });
  writeFileSync(
    join(promptSkillDir, "config.json"),
    `${JSON.stringify({
      enabled: true,
      mode: "suggest",
      hostConfidenceThresholds: {
        codex: 0.6
      },
      updatedAt: "2026-04-19T10:00:00.000Z"
    }, null, 2)}\n`
  );

  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:history-override-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-override-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-history-override-1",
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
  const exitCode = await runCli(["preflight", "优化一下这个导入逻辑", "--host", "codex", "--json"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    evidence: {
      lowConfidenceSlots: string[];
      confidenceThreshold: number;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.deepEqual(payload.evidence.lowConfidenceSlots, []);
  assert.equal(payload.evidence.confidenceThreshold, 0.6);
});
