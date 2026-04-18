import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { globalDataDir, databasePath } from "../../config/paths.js";
import { readProjectPolicy } from "../../config/project-policy.js";
import { compileOrClarify } from "../../compiler/compiler.js";
import { retrievePromptSnippets } from "../../compiler/history-retriever.js";
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

  try {
    const profile = profileRepository.load("global");
    const snippets = retrievePromptSnippets(promptRepository, input.prompt);
    const decision = compileOrClarify(input.prompt, profile.inferred, snippets);

    if (decision.kind === "questions") {
      return {
        decision: "block",
        reason: `Prompt Skill 需要先补充这些信息：\n- ${decision.followUpQuestions.join("\n- ")}`
      };
    }

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
