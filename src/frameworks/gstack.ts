import type { FrameworkRenderInput } from "./base.js";

export function renderGstackBrief(input: FrameworkRenderInput): string {
  return [
    "CEO brief:",
    input.compiledPrompt,
    "",
    "Suggested command: /office-hours"
  ].join("\n");
}
