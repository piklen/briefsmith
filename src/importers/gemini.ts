import { join } from "node:path";
import type { PromptEntry } from "../core/types.js";
import { readJsonFile, readJsonLines, walkFiles } from "../utils/filesystem.js";
import { createPromptEntry, type Importer, toIsoTimestamp } from "./base.js";

export class GeminiImporter implements Importer {
  readonly tool = "gemini" as const;

  async scan(homeDir: string): Promise<PromptEntry[]> {
    const roots = [
      join(homeDir, ".gemini", "history"),
      join(homeDir, ".gemini", "tmp")
    ];

    const files = (
      await Promise.all(
        roots.map((root) =>
          walkFiles(root, (path) => path.endsWith(".json") || path.endsWith(".jsonl"))
        )
      )
    ).flat();

    const prompts = await Promise.all(files.map((file) => this.parseFile(file)));
    return prompts.flat();
  }

  async parseFile(path: string): Promise<PromptEntry[]> {
    if (path.endsWith(".jsonl")) {
      const rows = await readJsonLines(path);
      return rows.flatMap((row, index) => this.extractRows(row, path, index));
    }

    const document = await readJsonFile<unknown>(path);
    return this.extractRows(document, path, 0);
  }

  private extractRows(document: unknown, path: string, sourceOffset: number): PromptEntry[] {
    const prompts: PromptEntry[] = [];

    if (Array.isArray(document)) {
      for (const [index, item] of document.entries()) {
        prompts.push(...this.extractRows(item, path, sourceOffset + index));
      }
      return prompts;
    }

    if (!document || typeof document !== "object") {
      return prompts;
    }

    const candidate = document as Record<string, unknown>;
    if (Array.isArray(candidate.messages)) {
      const sessionId = typeof candidate.session_id === "string" ? candidate.session_id : "unknown";
      const projectPath = typeof candidate.cwd === "string" ? candidate.cwd : "";
      for (const [index, message] of candidate.messages.entries()) {
        if (!message || typeof message !== "object") {
          continue;
        }

        const typedMessage = message as Record<string, unknown>;
        if (typedMessage.role !== "user" || typeof typedMessage.text !== "string") {
          continue;
        }

        prompts.push(
          createPromptEntry({
            tool: this.tool,
            projectPath,
            sessionId,
            timestamp: toIsoTimestamp(typedMessage.timestamp as string | number | undefined),
            promptText: typedMessage.text,
            sourceFile: path,
            sourceOffset: sourceOffset + index
          })
        );
      }
    }

    if (candidate.role === "user" && typeof candidate.text === "string") {
      prompts.push(
        createPromptEntry({
          tool: this.tool,
          projectPath: typeof candidate.cwd === "string" ? candidate.cwd : "",
          sessionId: typeof candidate.session_id === "string" ? candidate.session_id : "unknown",
          timestamp: toIsoTimestamp(candidate.timestamp as string | number | undefined),
          promptText: candidate.text,
          sourceFile: path,
          sourceOffset
        })
      );
    }

    return prompts;
  }
}
