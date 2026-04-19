import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../src/storage/database.js";

test("database migration creates prompt and profile tables", () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-db-"));
  const db = new Database(join(root, "skill.db"));

  const tables = db.listTables();
  const compileSessionColumns = db.connection
    .prepare("PRAGMA table_info(compile_sessions)")
    .all() as Array<{ name: string }>;

  assert.equal(tables.includes("prompts"), true);
  assert.equal(tables.includes("profiles"), true);
  assert.equal(tables.includes("project_policies"), true);
  assert.equal(tables.includes("compile_sessions"), true);
  assert.equal(compileSessionColumns.some((column) => column.name === "history_slot_ids_json"), true);
});
