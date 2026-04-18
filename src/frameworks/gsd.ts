import type { FrameworkRenderInput } from "./base.js";

export function renderGsdContext(input: FrameworkRenderInput): string {
  return [
    "PROJECT.md",
    `- Goal: ${input.rawInput}`,
    "",
    "STATE.md",
    `- Current compiled prompt: ${input.compiledPrompt}`
  ].join("\n");
}
