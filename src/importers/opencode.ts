import { join } from "node:path";
import type { PromptEntry } from "../core/types.js";
import { createPromptEntry, type Importer, toIsoTimestamp } from "./base.js";
import { readJsonFile, walkFiles } from "../utils/filesystem.js";

interface OpenCodeMessageRow {
  id: string;
  role: string;
  sessionID: string;
  time?: {
    created?: number;
  };
}

interface OpenCodePartRow {
  text?: string;
  type: string;
}

interface OpenCodeSessionRow {
  directory?: string;
  id: string;
}

export class OpenCodeImporter implements Importer {
  readonly tool = "opencode" as const;

  async scan(homeDir: string): Promise<PromptEntry[]> {
    const storageRoot = join(homeDir, ".local", "share", "opencode", "storage");
    const files = await walkFiles(join(storageRoot, "message"), (path) => path.endsWith(".json"));
    const prompts = await Promise.all(files.map((file) => this.parseMessageFile(file, storageRoot)));
    return prompts.flat();
  }

  async parseMessageFile(path: string, storageRoot: string): Promise<PromptEntry[]> {
    const message = await readJsonFile<OpenCodeMessageRow>(path);
    if (message.role !== "user") {
      return [];
    }

    const partFiles = await walkFiles(join(storageRoot, "part", message.id), (partPath) => partPath.endsWith(".json"));
    const parts = await Promise.all(partFiles.map((partPath) => readJsonFile<OpenCodePartRow>(partPath)));
    const promptText = parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter((text) => text.length > 0)
      .join("\n");

    if (promptText.length === 0) {
      return [];
    }

    const session = await loadOpenCodeSession(storageRoot, message.sessionID);
    return [
      createPromptEntry({
        tool: this.tool,
        projectPath: session?.directory ?? "",
        sessionId: message.sessionID,
        timestamp: toIsoTimestamp(message.time?.created),
        promptText,
        sourceFile: path,
        sourceOffset: 0
      })
    ];
  }
}

async function loadOpenCodeSession(storageRoot: string, sessionId: string): Promise<OpenCodeSessionRow | null> {
  const sessionFiles = await walkFiles(join(storageRoot, "session"), (path) => path.endsWith(`${sessionId}.json`));
  const file = sessionFiles[0];
  if (!file) {
    return null;
  }

  return readJsonFile<OpenCodeSessionRow>(file);
}
