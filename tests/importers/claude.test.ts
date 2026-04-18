import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeImporter } from "../../src/importers/claude.js";

test("Claude importer extracts user prompts from jsonl history", async () => {
  const importer = new ClaudeImporter();
  const rows = await importer.parseFile("tests/fixtures/claude/session.jsonl");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tool, "claude");
  assert.equal(rows[0]?.projectPath, "/tmp/project");
  assert.equal(rows[0]?.sessionId, "claude-session-1");
  assert.equal(rows[0]?.promptText.includes("optimize this function"), true);
});
