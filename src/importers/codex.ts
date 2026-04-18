import { join } from "node:path";
import type { PromptEntry } from "../core/types.js";
import { readJsonLines, walkFiles, pathExists } from "../utils/filesystem.js";
import { createPromptEntry, type Importer, toIsoTimestamp } from "./base.js";

export class CodexImporter implements Importer {
  readonly tool = "codex" as const;

  async scan(homeDir: string): Promise<PromptEntry[]> {
    const root = join(homeDir, ".codex");
    const sessionFiles = await walkFiles(join(root, "sessions"), (path) => path.endsWith(".jsonl"));
    const sessionEntries = await Promise.all(sessionFiles.map((file) => this.parseSessionFile(file)));
    const prompts = sessionEntries.flat();

    const sessionProjectMap = new Map<string, string>();
    for (const prompt of prompts) {
      if (prompt.projectPath.length > 0) {
        sessionProjectMap.set(prompt.sessionId, prompt.projectPath);
      }
    }

    const historyPath = join(root, "history.jsonl");
    if (await pathExists(historyPath)) {
      prompts.push(...(await this.parseHistoryFile(historyPath, sessionProjectMap)));
    }

    return prompts;
  }

  async parseHistoryFile(path: string, sessionProjectMap = new Map<string, string>()): Promise<PromptEntry[]> {
    const rows = await readJsonLines(path);
    const prompts: PromptEntry[] = [];

    for (const [index, row] of rows.entries()) {
      if (!isCodexHistoryRow(row)) {
        continue;
      }

      prompts.push(
        createPromptEntry({
          tool: this.tool,
          projectPath: sessionProjectMap.get(row.session_id) ?? "",
          sessionId: row.session_id,
          timestamp: toIsoTimestamp(row.ts),
          promptText: row.text,
          sourceFile: path,
          sourceOffset: index
        })
      );
    }

    return prompts;
  }

  async parseSessionFile(path: string): Promise<PromptEntry[]> {
    const rows = await readJsonLines(path);
    const prompts: PromptEntry[] = [];
    let sessionId = "unknown";
    let projectPath = "";

    for (const [index, row] of rows.entries()) {
      if (isCodexSessionMetaRow(row)) {
        sessionId = row.payload.id ?? sessionId;
        projectPath = row.payload.cwd ?? projectPath;
        continue;
      }

      if (!isCodexUserMessageRow(row)) {
        continue;
      }

      prompts.push(
        createPromptEntry({
          tool: this.tool,
          projectPath,
          sessionId,
          timestamp: toIsoTimestamp(row.timestamp),
          promptText: row.payload.message,
          sourceFile: path,
          sourceOffset: index
        })
      );
    }

    return prompts;
  }
}

function isCodexHistoryRow(row: unknown): row is {
  session_id: string;
  text: string;
  ts: number | string;
} {
  if (!row || typeof row !== "object") {
    return false;
  }

  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate.session_id === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.ts !== "undefined"
  );
}

function isCodexSessionMetaRow(row: unknown): row is {
  payload: { cwd?: string; id?: string };
  type: string;
} {
  if (!row || typeof row !== "object") {
    return false;
  }

  const candidate = row as Record<string, unknown>;
  return candidate.type === "session_meta" && typeof candidate.payload === "object" && candidate.payload !== null;
}

function isCodexUserMessageRow(row: unknown): row is {
  payload: { message: string; type: string };
  timestamp: string | number;
  type: string;
} {
  if (!row || typeof row !== "object") {
    return false;
  }

  const candidate = row as Record<string, unknown>;
  const payload = candidate.payload as Record<string, unknown> | undefined;
  return (
    candidate.type === "event_msg" &&
    payload?.type === "user_message" &&
    typeof payload.message === "string"
  );
}
