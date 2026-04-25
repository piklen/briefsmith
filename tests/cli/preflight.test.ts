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
  assert.deepEqual(payload.evidence.initialMissingSlots, ["target", "success_criteria", "constraints", "verification"]);
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
  assert.equal(payload.evidence.resolvedSlotConfidence.verification, 0.78);
  assert.equal(payload.evidence.resolvedSlotSources.target, "input");
  assert.equal(payload.evidence.resolvedSlotSources.success_criteria, "heuristic");
  assert.equal(payload.evidence.resolvedSlotSources.constraints, "history");
  assert.equal(payload.evidence.resolvedSlotSources.verification, "heuristic");
  assert.equal(latest?.targetHost, "cli");
  assert.equal(latest?.resolvedSlots.constraints?.includes("外部行为"), true);
  assert.equal(payload.resolvedSlots.verification?.includes("验证"), true);
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
  assert.equal(payload.evidence.resolvedSlotConfidence.verification, 0.78);
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
  assert.deepEqual(payload.evidence.initialMissingSlots, ["target", "success_criteria", "constraints", "verification"]);
  assert.deepEqual(payload.evidence.unresolvedSlots, ["target", "constraints"]);
  assert.deepEqual(payload.evidence.lowConfidenceSlots, ["success_criteria"]);
  assert.equal(payload.evidence.confidenceThreshold, 0.75);
  assert.equal(payload.evidence.historyMatchCount, 0);
  assert.deepEqual(payload.evidence.historyMatches, []);
  assert.equal(payload.evidence.resolvedSlotConfidence.success_criteria, 0.68);
  assert.equal(payload.evidence.resolvedSlotConfidence.verification, 0.78);
  assert.equal(payload.evidence.resolvedSlotSources.success_criteria, "heuristic");
  assert.equal(payload.evidence.resolvedSlotSources.verification, "heuristic");
});

test("runCli preflight rejects unsupported hosts instead of silently using cli defaults", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const output: string[] = [];

  const exitCode = await runCli(["preflight", "优化一下", "--host", "cursor", "--json"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 1);
  assert.equal(output.some((line) => line.includes("unsupported host: cursor")), true);
});

test("runCli preflight rejects unsupported frameworks instead of silently rendering plain text", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const output: string[] = [];

  const exitCode = await runCli(["preflight", "优化一下", "--framework", "markdown"], {
    cwd: process.cwd(),
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 1);
  assert.equal(output.some((line) => line.includes("unsupported framework: markdown")), true);
});

test("runCli preflight asks for problem signals on bugfix-style requests", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const output: string[] = [];

  const exitCode = await runCli(
    [
      "preflight",
      "修复这个登录流程，不要改变外部接口，并运行相关测试验证",
      "--host",
      "codex",
      "--json"
    ],
    {
      cwd: process.cwd(),
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    }
  );

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    questions: string[];
    evidence: {
      initialMissingSlots: string[];
      unresolvedSlots: string[];
      lowConfidenceSlots: string[];
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.equal(payload.evidence.initialMissingSlots.includes("problem_signal"), true);
  assert.equal(payload.evidence.unresolvedSlots.includes("problem_signal"), true);
  assert.equal(payload.questions.some((question) => question.includes("现象")), true);
});

test("runCli preflight does not fill slots from unrelated history matches", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:irrelevant-memory-1",
      tool: "codex",
      projectPath: process.cwd(),
      sessionId: "session-irrelevant-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "Memory agent workflow for future checkout tasks. The goal is to help future agents fix similar tasks with fewer tool calls and better workflow summaries.",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-irrelevant-memory-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(
    ["preflight", "fix this checkout flow", "--host", "codex", "--json"],
    {
      cwd: process.cwd(),
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    }
  );

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    questions: string[];
    resolvedSlots: Record<string, string>;
    usedHistoryIds: string[];
    evidence: {
      initialMissingSlots: string[];
      unresolvedSlots: string[];
      resolvedSlotSources: Record<string, string>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.equal(payload.questions.length, 1);
  assert.equal(payload.questions[0]?.includes("checkout flow"), true);
  assert.equal(payload.questions[0]?.includes("symptom"), true);
  assert.deepEqual(payload.usedHistoryIds, []);
  assert.equal(payload.evidence.initialMissingSlots.includes("problem_signal"), true);
  assert.equal(payload.evidence.unresolvedSlots.includes("problem_signal"), true);
  assert.equal(payload.resolvedSlots.problem_signal, undefined);
  assert.equal(payload.evidence.resolvedSlotSources.problem_signal, undefined);
});

test("runCli preflight ignores cross-project history when enriching the current repo", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:other-project-history-1",
      tool: "codex",
      projectPath: "/tmp/other-project",
      sessionId: "session-other-project-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "Fix checkout flow timeout without changing the payment API.",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-other-project-history-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(
    ["preflight", "fix this checkout flow", "--host", "codex", "--json"],
    {
      cwd: process.cwd(),
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    }
  );

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    resolvedSlots: Record<string, string>;
    usedHistoryIds: string[];
    evidence: {
      historyMatchCount: number;
      resolvedSlotSources: Record<string, string>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.deepEqual(payload.usedHistoryIds, []);
  assert.equal(payload.evidence.historyMatchCount, 0);
  assert.equal(payload.resolvedSlots.problem_signal, undefined);
  assert.equal(payload.evidence.resolvedSlotSources.problem_signal, undefined);
});

test("runCli preflight reuses the latest same-project compile session for continuation requests", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const compileSessionRepository = new CompileSessionRepository(database);
  const promptRepository = new PromptRepository(database);

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

  compileSessionRepository.save({
    rawInput: "优化这个导入逻辑，保持外部命令行为不变，并运行相关测试验证",
    compiledPrompt: "Task Goal\n优化这个导入逻辑",
    followUpQuestions: [],
    resolvedSlots: {
      target: "导入逻辑",
      constraints: "不要改变外部命令行为",
      verification: "运行相关测试验证"
    },
    projectPath: root,
    targetFramework: "plain",
    targetHost: "codex",
    usedHistoryIds: []
  });
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["preflight", "继续优化", "--host", "cli", "--json"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    resolvedSlots: Record<string, string>;
    usedHistoryIds: string[];
    evidence: {
      historyMatchCount: number;
      resolvedSlotSources: Record<string, string>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.equal(payload.resolvedSlots.target, "导入逻辑");
  assert.equal(payload.resolvedSlots.constraints, "不要改变外部命令行为");
  assert.equal(payload.resolvedSlots.verification, "运行相关测试验证");
  assert.deepEqual(payload.usedHistoryIds, []);
  assert.equal(payload.evidence.historyMatchCount, 0);
  assert.equal(payload.evidence.resolvedSlotSources.target, "session");
  assert.equal(payload.evidence.resolvedSlotSources.constraints, "session");
  assert.equal(payload.evidence.resolvedSlotSources.verification, "session");
});

test("runCli preflight does not turn meta history text into execution constraints", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:meta-history-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-meta-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "帮我优化，如果不能那需要让ai去问用户。",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-meta-history-1",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    }
  ]);
  database.close();

  const output: string[] = [];
  const exitCode = await runCli(["preflight", "帮我优化", "--host", "codex", "--json"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    usedHistoryIds: string[];
    resolvedSlots: Record<string, string>;
    evidence: {
      initialMissingSlots: string[];
      unresolvedSlots: string[];
      historyMatchCount: number;
      historyMatches: Array<{
        id: string;
        tool: string;
        preview: string;
      }>;
      resolvedSlotSources: Record<string, string>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "ask");
  assert.equal(payload.evidence.initialMissingSlots.includes("target"), true);
  assert.equal(payload.evidence.unresolvedSlots.includes("target"), true);
  assert.deepEqual(payload.usedHistoryIds, []);
  assert.equal(payload.evidence.historyMatchCount, 0);
  assert.deepEqual(payload.evidence.historyMatches, []);
  assert.equal(payload.resolvedSlots.constraints, undefined);
  assert.equal(payload.evidence.resolvedSlotSources.constraints, undefined);
});

test("runCli preflight only reports the history entry that actually resolved a slot", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:meta-history-2",
      tool: "codex",
      projectPath: root,
      sessionId: "session-meta-2",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化一下这个导入逻辑，如果不能那需要让ai去问用户。",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-meta-history-2",
      isFavorite: false,
      tags: [],
      importedAt: "2026-04-19T10:00:00.000Z"
    },
    {
      id: "codex:constraint-history-2",
      tool: "codex",
      projectPath: root,
      sessionId: "session-constraint-2",
      timestamp: "2026-04-19T10:00:01.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 1,
      fingerprint: "fp-constraint-history-2",
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
  const exitCode = await runCli(["preflight", "优化一下这个导入逻辑", "--host", "cli", "--json"], {
    cwd: root,
    homeDir,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const payload = JSON.parse(output.join("\n")) as {
    action: string;
    usedHistoryIds: string[];
    evidence: {
      historyMatchCount: number;
      historySlotIds: Record<string, string>;
      historyMatches: Array<{
        id: string;
        tool: string;
        preview: string;
      }>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.deepEqual(payload.usedHistoryIds, ["codex:constraint-history-2"]);
  assert.equal(payload.evidence.historyMatchCount, 1);
  assert.equal(payload.evidence.historySlotIds.constraints, "codex:constraint-history-2");
  assert.deepEqual(payload.evidence.historyMatches, [
    {
      id: "codex:constraint-history-2",
      tool: "codex",
      preview: "优化导入逻辑并保持外部命令行为不变"
    }
  ]);
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

test("runCli preflight respects project-level per-slot confidence threshold overrides", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const promptSkillDir = join(root, ".prompt-skill");
  mkdirSync(promptSkillDir, { recursive: true });
  writeFileSync(
    join(promptSkillDir, "config.json"),
    `${JSON.stringify({
      enabled: true,
      mode: "suggest",
      hostConfidenceThresholds: {
        codex: 0.9
      },
      hostSlotConfidenceThresholds: {
        codex: {
          success_criteria: 0.6,
          constraints: 0.8,
          verification: 0.75
        }
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
      id: "codex:history-slot-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-slot-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-history-slot-1",
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
      slotConfidenceThresholds: Record<string, number>;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.deepEqual(payload.evidence.lowConfidenceSlots, []);
  assert.equal(payload.evidence.confidenceThreshold, 0.9);
  assert.equal(payload.evidence.slotConfidenceThresholds.success_criteria, 0.6);
  assert.equal(payload.evidence.slotConfidenceThresholds.constraints, 0.8);
  assert.equal(payload.evidence.slotConfidenceThresholds.verification, 0.75);
  assert.equal(payload.evidence.slotConfidenceThresholds.target, 0.9);
});

test("runCli preflight bypasses low-confidence gate in auto-compile mode", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-project-"));
  const promptSkillDir = join(root, ".prompt-skill");
  mkdirSync(promptSkillDir, { recursive: true });
  writeFileSync(
    join(promptSkillDir, "config.json"),
    `${JSON.stringify({
      enabled: true,
      mode: "auto-compile",
      updatedAt: "2026-04-19T10:00:00.000Z"
    }, null, 2)}\n`
  );

  const homeDir = mkdtempSync(join(tmpdir(), "prompt-skill-home-"));
  const database = new Database(databasePath(globalDataDir(homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:history-auto-1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-auto-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入逻辑并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-history-auto-1",
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
      confidenceGateApplied: boolean;
    };
  };

  assert.equal(exitCode, 0);
  assert.equal(payload.action, "compile");
  assert.deepEqual(payload.evidence.lowConfidenceSlots, ["success_criteria"]);
  assert.equal(payload.evidence.confidenceGateApplied, false);
});
