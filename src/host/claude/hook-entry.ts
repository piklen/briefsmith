import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { globalDataDir, databasePath } from "../../config/paths.js";
import { readProjectPolicy } from "../../config/project-policy.js";
import { buildFollowUpQuestions } from "../../compiler/clarifier.js";
import { compileOrClarify } from "../../compiler/compiler.js";
import { isContinuationOnlyRequest, shouldUseHistoryEnrichment } from "../../compiler/continuation.js";
import { retrievePromptEntries } from "../../compiler/history-retriever.js";
import type { SlotName } from "../../core/types.js";
import { CompileSessionRepository } from "../../storage/compile-session-repository.js";
import { Database } from "../../storage/database.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export interface ClaudeUserPromptSubmitInput {
  cwd: string;
  hook_event_name: "UserPromptSubmit";
  permission_mode: string;
  prompt: string;
  session_id: string;
  transcript_path: string;
}

export interface ClaudeHookRuntimeContext {
  cwd: string;
  homeDir: string;
}

export interface ClaudeHookResult {
  decision?: "block";
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
  };
}

const SLOT_ORDER: SlotName[] = ["target", "problem_signal", "success_criteria", "constraints", "verification", "output_format"];

export async function evaluateClaudePromptHook(
  input: ClaudeUserPromptSubmitInput,
  runtime: ClaudeHookRuntimeContext
): Promise<ClaudeHookResult | null> {
  const policy = await readProjectPolicy(runtime.cwd);
  if (!policy.enabled) {
    return null;
  }

  const database = new Database(databasePath(globalDataDir(runtime.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);
  const compileSessionRepository = new CompileSessionRepository(database);

  try {
    const profile = profileRepository.load("global");
    const continuationSlots = isContinuationOnlyRequest(input.prompt)
      ? (compileSessionRepository.latestForProject(runtime.cwd)?.resolvedSlots ?? {})
      : {};
    const historyMatches = shouldUseHistoryEnrichment(input.prompt)
      ? retrievePromptEntries(promptRepository, input.prompt, 3, {
          projectPath: runtime.cwd
        })
      : [];
    const decision = compileOrClarify(
      input.prompt,
      profile.inferred,
      historyMatches.map((row) => ({
        id: row.id,
        text: row.promptText
      })),
      continuationSlots
    );

    if (decision.kind === "questions") {
      compileSessionRepository.save({
        projectPath: runtime.cwd,
        rawInput: input.prompt,
        compiledPrompt: "",
        followUpQuestions: decision.followUpQuestions,
        resolvedSlots: decision.resolvedSlots,
        targetFramework: "plain",
        targetHost: "claude",
        usedHistoryIds: decision.usedHistoryIds,
        historySlotIds: decision.resolvedSlotHistoryIds
      });

      return {
        decision: "block",
        reason: `Prompt Skill 需要先补充这些信息：\n- ${decision.followUpQuestions.join("\n- ")}`
      };
    }

    const lowConfidenceSlots = policy.mode === "auto-compile"
      ? []
      : findLowConfidenceSlots(
          decision.resolvedSlotConfidence,
          policy.hostSlotConfidenceThresholds.claude
        );
    if (lowConfidenceSlots.length > 0) {
      const followUpQuestions = buildFollowUpQuestions({
        rawInput: input.prompt,
        missing: lowConfidenceSlots,
        resolvedSlots: decision.resolvedSlots,
        inferredDefaults: profile.inferred
      });
      compileSessionRepository.save({
        projectPath: runtime.cwd,
        rawInput: input.prompt,
        compiledPrompt: "",
        followUpQuestions,
        resolvedSlots: decision.resolvedSlots,
        targetFramework: "plain",
        targetHost: "claude",
        usedHistoryIds: decision.usedHistoryIds,
        historySlotIds: decision.resolvedSlotHistoryIds
      });

      return {
        decision: "block",
        reason: `Prompt Skill 需要先补充这些信息：\n- ${followUpQuestions.join("\n- ")}`
      };
    }

    compileSessionRepository.save({
      projectPath: runtime.cwd,
      rawInput: input.prompt,
      compiledPrompt: decision.text,
      followUpQuestions: [],
      resolvedSlots: decision.resolvedSlots,
      targetFramework: "plain",
      targetHost: "claude",
      usedHistoryIds: decision.usedHistoryIds,
      historySlotIds: decision.resolvedSlotHistoryIds
    });

    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `Prompt Skill Context\n${decision.text}`
      }
    };
  } finally {
    database.close();
  }
}

function findLowConfidenceSlots(
  resolvedSlotConfidence: Partial<Record<SlotName, number>>,
  slotThresholds: Record<SlotName, number>
): SlotName[] {
  return SLOT_ORDER.filter((slot) => {
    const value = resolvedSlotConfidence[slot];
    const threshold = slotThresholds[slot];
    return typeof value === "number" && value < threshold;
  });
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return;
  }

  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ClaudeUserPromptSubmitInput;
  const result = await evaluateClaudePromptHook(input, {
    cwd: input.cwd,
    homeDir: homedir()
  });

  if (result) {
    process.stdout.write(JSON.stringify(result));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
