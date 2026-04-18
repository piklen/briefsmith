import type { Importer } from "./base.js";
import { ClaudeImporter } from "./claude.js";
import { CodexImporter } from "./codex.js";
import { OpenCodeImporter } from "./opencode.js";
import { GeminiImporter } from "./gemini.js";

export function builtInImporters(): Importer[] {
  return [
    new ClaudeImporter(),
    new CodexImporter(),
    new OpenCodeImporter(),
    new GeminiImporter()
  ];
}
