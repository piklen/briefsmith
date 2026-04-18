import type { DatabaseSync } from "node:sqlite";

export function applyMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      project_path TEXT NOT NULL,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_offset INTEGER NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
      tags_json TEXT NOT NULL DEFAULT '[]',
      imported_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_prompts_timestamp ON prompts(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_tool ON prompts(tool);
    CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id);

    CREATE TABLE IF NOT EXISTS profiles (
      scope TEXT PRIMARY KEY,
      confirmed_json TEXT NOT NULL,
      inferred_json TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS project_policies (
      scope_key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      mode TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS compile_sessions (
      id TEXT PRIMARY KEY,
      raw_input TEXT NOT NULL,
      compiled_prompt TEXT NOT NULL,
      follow_up_questions_json TEXT NOT NULL,
      resolved_slots_json TEXT NOT NULL,
      target_framework TEXT NOT NULL,
      target_host TEXT NOT NULL,
      used_history_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
  `);
}
