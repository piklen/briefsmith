import test from "node:test";
import assert from "node:assert/strict";
import { GeminiImporter } from "../../src/importers/gemini.js";

test("Gemini importer extracts user prompts from supported json history", async () => {
  const importer = new GeminiImporter();
  const rows = await importer.parseFile("tests/fixtures/gemini/history.json");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tool, "gemini");
  assert.equal(rows[0]?.sessionId, "gemini-session-1");
  assert.equal(rows[0]?.promptText.includes("write a deployment checklist"), true);
});
