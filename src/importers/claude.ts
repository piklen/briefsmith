import { join } from "node:path";
import type { PromptEntry } from "../core/types.js";
import { readJsonLines, walkFiles } from "../utils/filesystem.js";
import { createPromptEntry, type Importer, toIsoTimestamp } from "./base.js";

function sanitizeClaudePrompt(text: string): string {
  return text.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "").trim();
}

export class ClaudeImporter implements Importer {
  readonly tool = "claude" as const;

  async scan(homeDir: string): Promise<PromptEntry[]> {
    const root = join(homeDir, ".claude", "projects");
    const files = await walkFiles(root, (path) => path.endsWith(".jsonl"));
    const prompts = await Promise.all(files.map((file) => this.parseFile(file)));
    return prompts.flat();
  }

  async parseFile(path: string): Promise<PromptEntry[]> {
    const rows = await readJsonLines(path);
    const prompts: PromptEntry[] = [];

    for (const [index, row] of rows.entries()) {
      if (!isClaudeUserRow(row)) {
        continue;
      }

      const promptText = sanitizeClaudePrompt(row.message.content);
      if (promptText.length === 0) {
        continue;
      }

      prompts.push(
        createPromptEntry({
          tool: this.tool,
          projectPath: row.cwd ?? "",
          sessionId: row.sessionId ?? "unknown",
          timestamp: toIsoTimestamp(row.timestamp),
          promptText,
          sourceFile: path,
          sourceOffset: index
        })
      );
    }

    return prompts;
  }
}

function isClaudeUserRow(row: unknown): row is {
  cwd?: string;
  message: { content: string; role: string };
  sessionId: string;
  timestamp: number | string;
  type: string;
} {
  if (!row || typeof row !== "object") {
    return false;
  }

  const candidate = row as Record<string, unknown>;
  const message = candidate.message as Record<string, unknown> | undefined;
  return (
    candidate.type === "user" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.timestamp !== "undefined" &&
    typeof message?.content === "string" &&
    message.role === "user"
  );
}
