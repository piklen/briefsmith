import type { Database } from "./database.js";
import type { PromptEntry } from "../core/types.js";

export class PromptRepository {
  constructor(private readonly database: Database) {}

  upsertMany(entries: PromptEntry[]): number {
    const statement = this.database.connection.prepare(`
      INSERT OR IGNORE INTO prompts (
        id, tool, project_path, session_id, timestamp, prompt_text,
        source_file, source_offset, fingerprint, is_favorite, tags_json, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    for (const entry of entries) {
      const result = statement.run(
        entry.id,
        entry.tool,
        entry.projectPath,
        entry.sessionId,
        entry.timestamp,
        entry.promptText,
        entry.sourceFile,
        entry.sourceOffset,
        entry.fingerprint,
        entry.isFavorite ? 1 : 0,
        JSON.stringify(entry.tags),
        entry.importedAt
      ) as { changes?: number };

      inserted += result.changes ?? 0;
    }

    return inserted;
  }

  count(): number {
    const row = this.database.connection
      .prepare("SELECT COUNT(*) AS count FROM prompts")
      .get() as { count: number };

    return row.count;
  }

  getById(id: string): PromptEntry | null {
    const row = this.database.connection
      .prepare(`
        SELECT
          id,
          tool,
          project_path AS projectPath,
          session_id AS sessionId,
          timestamp,
          prompt_text AS promptText,
          source_file AS sourceFile,
          source_offset AS sourceOffset,
          fingerprint,
          is_favorite AS isFavorite,
          tags_json AS tagsJson,
          imported_at AS importedAt
        FROM prompts
        WHERE id = ?
      `)
      .get(id) as
      | {
          id: string;
          tool: PromptEntry["tool"];
          projectPath: string;
          sessionId: string;
          timestamp: string;
          promptText: string;
          sourceFile: string;
          sourceOffset: number;
          fingerprint: string;
          isFavorite: number;
          tagsJson: string;
          importedAt: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tool: row.tool,
      projectPath: row.projectPath,
      sessionId: row.sessionId,
      timestamp: row.timestamp,
      promptText: row.promptText,
      sourceFile: row.sourceFile,
      sourceOffset: row.sourceOffset,
      fingerprint: row.fingerprint,
      isFavorite: Boolean(row.isFavorite),
      tags: JSON.parse(row.tagsJson) as string[],
      importedAt: row.importedAt
    };
  }

  search(query: string, limit = 20): PromptEntry[] {
    const trimmed = query.trim();
    const rows = trimmed.length === 0
      ? (this.database.connection
          .prepare(`
            SELECT
              id,
              tool,
              project_path AS projectPath,
              session_id AS sessionId,
              timestamp,
              prompt_text AS promptText,
              source_file AS sourceFile,
              source_offset AS sourceOffset,
              fingerprint,
              is_favorite AS isFavorite,
              tags_json AS tagsJson,
              imported_at AS importedAt
            FROM prompts
            ORDER BY timestamp DESC
            LIMIT ?
          `)
          .all(limit) as Array<Record<string, unknown>>)
      : (this.database.connection
          .prepare(`
            SELECT
              id,
              tool,
              project_path AS projectPath,
              session_id AS sessionId,
              timestamp,
              prompt_text AS promptText,
              source_file AS sourceFile,
              source_offset AS sourceOffset,
              fingerprint,
              is_favorite AS isFavorite,
              tags_json AS tagsJson,
              imported_at AS importedAt
            FROM prompts
            WHERE prompt_text LIKE '%' || ? || '%'
               OR project_path LIKE '%' || ? || '%'
               OR session_id LIKE '%' || ? || '%'
            ORDER BY timestamp DESC
            LIMIT ?
          `)
          .all(trimmed, trimmed, trimmed, limit) as Array<Record<string, unknown>>);

    return rows.map((row) => ({
      id: String(row.id),
      tool: row.tool as PromptEntry["tool"],
      projectPath: String(row.projectPath),
      sessionId: String(row.sessionId),
      timestamp: String(row.timestamp),
      promptText: String(row.promptText),
      sourceFile: String(row.sourceFile),
      sourceOffset: Number(row.sourceOffset),
      fingerprint: String(row.fingerprint),
      isFavorite: Boolean(row.isFavorite),
      tags: JSON.parse(String(row.tagsJson)) as string[],
      importedAt: String(row.importedAt)
    }));
  }

  setFavorite(id: string, favorite: boolean): boolean {
    const result = this.database.connection
      .prepare("UPDATE prompts SET is_favorite = ? WHERE id = ?")
      .run(favorite ? 1 : 0, id) as { changes?: number };

    return (result.changes ?? 0) > 0;
  }

  favorites(limit = 100): PromptEntry[] {
    const rows = this.database.connection
      .prepare(`
        SELECT
          id,
          tool,
          project_path AS projectPath,
          session_id AS sessionId,
          timestamp,
          prompt_text AS promptText,
          source_file AS sourceFile,
          source_offset AS sourceOffset,
          fingerprint,
          is_favorite AS isFavorite,
          tags_json AS tagsJson,
          imported_at AS importedAt
        FROM prompts
        WHERE is_favorite = 1
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      tool: row.tool as PromptEntry["tool"],
      projectPath: String(row.projectPath),
      sessionId: String(row.sessionId),
      timestamp: String(row.timestamp),
      promptText: String(row.promptText),
      sourceFile: String(row.sourceFile),
      sourceOffset: Number(row.sourceOffset),
      fingerprint: String(row.fingerprint),
      isFavorite: Boolean(row.isFavorite),
      tags: JSON.parse(String(row.tagsJson)) as string[],
      importedAt: String(row.importedAt)
    }));
  }

  setTags(id: string, tags: string[]): boolean {
    const normalizedTags = normalizeTags(tags);
    const result = this.database.connection
      .prepare("UPDATE prompts SET tags_json = ? WHERE id = ?")
      .run(JSON.stringify(normalizedTags), id) as { changes?: number };

    return (result.changes ?? 0) > 0;
  }

  addTag(id: string, tag: string): PromptEntry | null {
    const prompt = this.getById(id);
    if (!prompt) {
      return null;
    }

    const nextTags = normalizeTags([...prompt.tags, tag]);
    this.setTags(id, nextTags);
    return this.getById(id);
  }

  removeTag(id: string, tag: string): PromptEntry | null {
    const prompt = this.getById(id);
    if (!prompt) {
      return null;
    }

    const nextTags = prompt.tags.filter((existing) => existing !== tag.trim());
    this.setTags(id, nextTags);
    return this.getById(id);
  }

  all(limit = 500): PromptEntry[] {
    return this.search("", limit);
  }

  countsByTool(): Array<{ tool: PromptEntry["tool"]; count: number }> {
    return this.database.connection
      .prepare(`
        SELECT tool, COUNT(*) AS count
        FROM prompts
        GROUP BY tool
        ORDER BY tool ASC
      `)
      .all() as Array<{ tool: PromptEntry["tool"]; count: number }>;
  }
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort();
}
