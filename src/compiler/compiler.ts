import type { CompileDecision, CompilePromptInput } from "../core/types.js";
import { buildFollowUpQuestions } from "./clarifier.js";
import { detectMissingSlots } from "./slot-detector.js";

export function compilePrompt(input: CompilePromptInput): string {
  const defaults = Object.entries(input.inferredDefaults)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");

  const answers = Object.entries(input.followUpAnswers)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const history = input.retrievedPromptSnippets.map((snippet) => `- ${snippet}`).join("\n");

  return [
    "Task Goal",
    input.rawInput,
    "",
    "Resolved Context",
    answers || "- none",
    "",
    "Inferred Defaults",
    defaults || "- none",
    "",
    "Relevant Prompt Memory",
    history || "- none",
    "",
    "Execution Requirements",
    "- keep the final answer aligned to the resolved context",
    "- call out assumptions when context is still incomplete",
    "- preserve risk boundaries from the resolved context"
  ].join("\n");
}

export function compileOrClarify(
  rawInput: string,
  inferredDefaults: Record<string, unknown>,
  retrievedPromptSnippets: string[]
): CompileDecision {
  const missingResult = detectMissingSlots(rawInput);

  if (missingResult.needsFollowUp) {
    return {
      kind: "questions",
      text: buildFollowUpQuestions(missingResult.missing).join("\n"),
      missing: missingResult.missing
    };
  }

  return {
    kind: "compiled",
    text: compilePrompt({
      rawInput,
      inferredDefaults,
      followUpAnswers: {},
      retrievedPromptSnippets
    }),
    missing: []
  };
}
