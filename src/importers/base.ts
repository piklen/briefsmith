import type { PromptEntry, ToolName } from "../core/types.js";
import { sha1 } from "../utils/hash.js";

export interface Importer {
  readonly tool: ToolName;
  scan(homeDir: string): Promise<PromptEntry[]>;
}

interface CreatePromptInput {
  tool: ToolName;
  projectPath: string;
  sessionId: string;
  timestamp: string;
  promptText: string;
  sourceFile: string;
  sourceOffset: number;
}

export function createPromptEntry(input: CreatePromptInput): PromptEntry {
  const fingerprint = sha1(
    [
      input.tool,
      input.projectPath,
      input.sessionId,
      input.timestamp,
      input.promptText,
      input.sourceFile,
      String(input.sourceOffset)
    ].join("|")
  );

  return {
    id: `${input.tool}:${fingerprint}`,
    tool: input.tool,
    projectPath: input.projectPath,
    sessionId: input.sessionId,
    timestamp: input.timestamp,
    promptText: input.promptText.trim(),
    sourceFile: input.sourceFile,
    sourceOffset: input.sourceOffset,
    fingerprint,
    isFavorite: false,
    tags: [],
    importedAt: new Date().toISOString()
  };
}

export function toIsoTimestamp(value: number | string | undefined): string {
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() === String(numeric)) {
      return new Date(numeric).toISOString();
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}
