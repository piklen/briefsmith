import test from "node:test";
import assert from "node:assert/strict";
import { OpenCodeImporter } from "../../src/importers/opencode.js";

test("OpenCode importer reconstructs user prompt text from message and part files", async () => {
  const importer = new OpenCodeImporter();
  const rows = await importer.parseMessageFile(
    "tests/fixtures/opencode/storage/message/ses_demo/msg_user_1.json",
    "tests/fixtures/opencode/storage"
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tool, "opencode");
  assert.equal(rows[0]?.projectPath, "/tmp/opencode-project");
  assert.equal(rows[0]?.sessionId, "ses_demo");
  assert.equal(rows[0]?.promptText, "Summarize this repository and identify risk.");
});
