import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installClaudeAdapter } from "../../src/host/claude/install.js";
import { evaluateClaudePromptHook } from "../../src/host/claude/hook-entry.js";
import { renderPromptMemoryClaudeSkill } from "../../src/host/prompt-memory-skill.js";
import { CompileSessionRepository } from "../../src/storage/compile-session-repository.js";
import { Database } from "../../src/storage/database.js";
import { PromptRepository } from "../../src/storage/prompt-repository.js";
import { ProfileRepository } from "../../src/storage/profile-repository.js";

test("installClaudeAdapter merges project settings and writes a prompt skill", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-claude-"));
  const claudeDir = join(root, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        env: {
          DEMO: "1"
        },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo hello" }]
            }
          ]
        }
      },
      null,
      2
    )
  );

  const result = await installClaudeAdapter({
    projectRoot: root,
    runtimeRoot: root,
    scope: "project"
  });

  assert.equal(result.writtenFiles.some((file) => file.endsWith(".claude/settings.json")), true);
  assert.equal(result.writtenFiles.some((file) => file.endsWith(".claude/skills/prompt-memory/SKILL.md")), true);

  const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8")) as Record<string, unknown>;
  const hooks = settings.hooks as Record<string, unknown>;
  const userPromptSubmit = hooks.UserPromptSubmit as Array<Record<string, unknown>>;

  assert.equal((settings.env as Record<string, string>).DEMO, "1");
  assert.equal(Array.isArray(userPromptSubmit), true);
  assert.equal(JSON.stringify(userPromptSubmit).includes("hook-entry.js"), true);
  assert.equal(
    readFileSync(join(claudeDir, "skills", "prompt-memory", "SKILL.md"), "utf8"),
    await renderPromptMemoryClaudeSkill()
  );
});

test("evaluateClaudePromptHook blocks vague prompts when required context is missing", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-hook-"));
  const dataDir = join(root, "data");
  const database = new Database(join(dataDir, "skill.db"));

  try {
    const result = await evaluateClaudePromptHook(
      {
        cwd: root,
        prompt: "优化一下这个逻辑",
        session_id: "session-1",
        transcript_path: join(root, "session.jsonl"),
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit"
      },
      {
        cwd: root,
        homeDir: root
      }
    );

    assert.equal(result?.decision, "block");
    assert.equal((result?.reason ?? "").includes("Prompt Skill"), true);
  } finally {
    database.close();
  }
});

test("evaluateClaudePromptHook injects additional context for sufficiently specific prompts", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-hook-"));
  const dataDir = join(root, "Library", "Application Support", "PromptSkill");
  const database = new Database(join(dataDir, "skill.db"));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
    {
      id: "codex:1",
      tool: "codex",
      projectPath: root,
      sessionId: "session-1",
      timestamp: "2026-04-19T10:00:00.000Z",
      promptText: "优化导入器并保持外部命令行为不变",
      sourceFile: "/tmp/source.jsonl",
      sourceOffset: 0,
      fingerprint: "fp-1",
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

  try {
    const result = await evaluateClaudePromptHook(
      {
        cwd: root,
        prompt: "优化这个导入逻辑，减少重复解析，并且不要改变外部命令行为，输出任务说明",
        session_id: "session-2",
        transcript_path: join(root, "session.jsonl"),
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit"
      },
      {
        cwd: root,
        homeDir: root
      }
    );

    assert.equal(result?.decision ?? "", "");
    assert.equal(
      result?.hookSpecificOutput?.additionalContext?.includes("Prompt Skill Context") ?? false,
      true
    );
  } finally {
    database.close();
  }
});

test("evaluateClaudePromptHook auto-fills high-confidence missing context instead of blocking", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-hook-"));
  const dataDir = join(root, "Library", "Application Support", "PromptSkill");
  const database = new Database(join(dataDir, "skill.db"));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  promptRepository.upsertMany([
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

  profileRepository.save({
    scope: "global",
    confirmed: {},
    inferred: {
      preferred_language: "zh-CN"
    },
    signals: {},
    updatedAt: "2026-04-19T10:00:00.000Z"
  });

  try {
    const result = await evaluateClaudePromptHook(
      {
        cwd: root,
        prompt: "优化一下这个导入逻辑",
        session_id: "session-3",
        transcript_path: join(root, "session.jsonl"),
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit"
      },
      {
        cwd: root,
        homeDir: root
      }
    );

    assert.equal(result?.decision ?? "", "");
    assert.equal(
      result?.hookSpecificOutput?.additionalContext?.includes("外部行为") ?? false,
      true
    );
  } finally {
    database.close();
  }
});

test("evaluateClaudePromptHook reuses the latest same-project compile session for continuation prompts", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-hook-"));
  const dataDir = join(root, "Library", "Application Support", "PromptSkill");
  const database = new Database(join(dataDir, "skill.db"));

  const compileSessionRepository = new CompileSessionRepository(database);
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
    targetHost: "claude",
    usedHistoryIds: []
  });

  try {
    const result = await evaluateClaudePromptHook(
      {
        cwd: root,
        prompt: "继续优化",
        session_id: "session-4",
        transcript_path: join(root, "session.jsonl"),
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit"
      },
      {
        cwd: root,
        homeDir: root
      }
    );

    assert.equal(result?.decision ?? "", "");
    assert.equal(
      result?.hookSpecificOutput?.additionalContext?.includes("导入逻辑") ?? false,
      true
    );
    assert.equal(
      result?.hookSpecificOutput?.additionalContext?.includes("不要改变外部命令行为") ?? false,
      true
    );
    assert.equal(
      result?.hookSpecificOutput?.additionalContext?.includes("Relevant Prompt Memory\n- none") ?? false,
      true
    );
  } finally {
    database.close();
  }
});
