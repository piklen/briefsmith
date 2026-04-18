import test from "node:test";
import assert from "node:assert/strict";
import { CodexImporter } from "../../src/importers/codex.js";

test("Codex importer extracts user prompts from history jsonl", async () => {
  const importer = new CodexImporter();
  const rows = await importer.parseHistoryFile("tests/fixtures/codex/history.jsonl");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tool, "codex");
  assert.equal(rows[0]?.sessionId, "codex-session-1");
  assert.equal(rows[0]?.promptText.includes("fix the broken test"), true);
});

test("Codex importer extracts user prompts and session cwd from session jsonl", async () => {
  const importer = new CodexImporter();
  const rows = await importer.parseSessionFile("tests/fixtures/codex/session.jsonl");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.projectPath, "/tmp/codex-project");
  assert.equal(rows[0]?.sessionId, "codex-session-1");
  assert.equal(rows[0]?.promptText.includes("refactor the importer"), true);
});
