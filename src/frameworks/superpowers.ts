import type { FrameworkRenderInput } from "./base.js";

export function renderSuperpowersBrief(input: FrameworkRenderInput): string {
  return [
    "Start from this clarified task brief:",
    input.compiledPrompt
  ].join("\n");
}
