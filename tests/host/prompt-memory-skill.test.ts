import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renderPromptMemoryClaudeSkill,
  renderPromptMemoryCodexAgentsSnippet,
  renderPromptMemoryCodexSkill,
  renderPromptMemoryOpenCodeInstructions
} from "../../src/host/prompt-memory-skill.js";

test("prompt-memory canonical skill renders the codex skill snapshot", async () => {
  const snapshot = readFileSync(new URL("../../templates/codex/SKILL.md", import.meta.url), "utf8");
  assert.equal(await renderPromptMemoryCodexSkill(), snapshot);
});

test("prompt-memory canonical skill renders the claude skill snapshot", async () => {
  const snapshot = readFileSync(new URL("../../templates/claude/SKILL.md", import.meta.url), "utf8");
  assert.equal(await renderPromptMemoryClaudeSkill(), snapshot);
});

test("prompt-memory canonical skill renders the codex AGENTS snapshot", async () => {
  const snapshot = readFileSync(new URL("../../templates/codex/AGENTS.snippet.md", import.meta.url), "utf8");
  assert.equal(await renderPromptMemoryCodexAgentsSnippet(), snapshot);
});

test("prompt-memory canonical skill renders the opencode instructions snapshot", async () => {
  const snapshot = readFileSync(new URL("../../templates/opencode/prompt-memory.md", import.meta.url), "utf8");
  assert.equal(await renderPromptMemoryOpenCodeInstructions(), snapshot);
});
