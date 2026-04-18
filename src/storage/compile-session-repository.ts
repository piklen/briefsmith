import { randomUUID } from "node:crypto";
import type { CompileSessionRecord } from "../core/types.js";
import type { Database } from "./database.js";

interface SaveCompileSessionInput {
  rawInput: string;
  compiledPrompt: string;
  followUpQuestions: string[];
  resolvedSlots: Record<string, string>;
  targetFramework: string;
  targetHost: string;
  usedHistoryIds: string[];
}

export class CompileSessionRepository {
  constructor(private readonly database: Database) {}

  save(input: SaveCompileSessionInput): CompileSessionRecord {
    const record: CompileSessionRecord = {
      id: randomUUID(),
      rawInput: input.rawInput,
      compiledPrompt: input.compiledPrompt,
      followUpQuestions: input.followUpQuestions,
      resolvedSlots: input.resolvedSlots,
      targetFramework: input.targetFramework,
      targetHost: input.targetHost,
      usedHistoryIds: input.usedHistoryIds,
      createdAt: new Date().toISOString()
    };

    this.database.connection
      .prepare(`
        INSERT INTO compile_sessions (
          id,
          raw_input,
          compiled_prompt,
          follow_up_questions_json,
          resolved_slots_json,
          target_framework,
          target_host,
          used_history_ids_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.rawInput,
        record.compiledPrompt,
        JSON.stringify(record.followUpQuestions),
        JSON.stringify(record.resolvedSlots),
        record.targetFramework,
        record.targetHost,
        JSON.stringify(record.usedHistoryIds),
        record.createdAt
      );

    return record;
  }

  latest(): CompileSessionRecord | null {
    return this.list(1)[0] ?? null;
  }

  getById(id: string): CompileSessionRecord | null {
    const row = this.database.connection
      .prepare(`
        SELECT
          id,
          raw_input AS rawInput,
          compiled_prompt AS compiledPrompt,
          follow_up_questions_json AS followUpQuestionsJson,
          resolved_slots_json AS resolvedSlotsJson,
          target_framework AS targetFramework,
          target_host AS targetHost,
          used_history_ids_json AS usedHistoryIdsJson,
          created_at AS createdAt
        FROM compile_sessions
        WHERE id = ?
      `)
      .get(id) as CompileSessionRow | undefined;

    return row ? hydrateCompileSession(row) : null;
  }

  list(limit = 20): CompileSessionRecord[] {
    const rows = this.database.connection
      .prepare(`
        SELECT
          id,
          raw_input AS rawInput,
          compiled_prompt AS compiledPrompt,
          follow_up_questions_json AS followUpQuestionsJson,
          resolved_slots_json AS resolvedSlotsJson,
          target_framework AS targetFramework,
          target_host AS targetHost,
          used_history_ids_json AS usedHistoryIdsJson,
          created_at AS createdAt
        FROM compile_sessions
        ORDER BY rowid DESC
        LIMIT ?
      `)
      .all(limit) as unknown as CompileSessionRow[];

    return rows.map(hydrateCompileSession);
  }
}

interface CompileSessionRow {
  id: string;
  rawInput: string;
  compiledPrompt: string;
  followUpQuestionsJson: string;
  resolvedSlotsJson: string;
  targetFramework: string;
  targetHost: string;
  usedHistoryIdsJson: string;
  createdAt: string;
}

function hydrateCompileSession(row: CompileSessionRow): CompileSessionRecord {
  return {
    id: row.id,
    rawInput: row.rawInput,
    compiledPrompt: row.compiledPrompt,
    followUpQuestions: JSON.parse(row.followUpQuestionsJson) as string[],
    resolvedSlots: JSON.parse(row.resolvedSlotsJson) as Record<string, string>,
    targetFramework: row.targetFramework,
    targetHost: row.targetHost,
    usedHistoryIds: JSON.parse(row.usedHistoryIdsJson) as string[],
    createdAt: row.createdAt
  };
}
