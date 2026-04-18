import { databasePath, globalDataDir } from "../../config/paths.js";
import { readProjectPolicy } from "../../config/project-policy.js";
import { compileOrClarify } from "../../compiler/compiler.js";
import { retrievePromptEntries } from "../../compiler/history-retriever.js";
import type { CliContext, SlotName } from "../../core/types.js";
import { renderGsdContext } from "../../frameworks/gsd.js";
import { renderGstackBrief } from "../../frameworks/gstack.js";
import { renderSuperpowersBrief } from "../../frameworks/superpowers.js";
import { Database } from "../../storage/database.js";
import { CompileSessionRepository } from "../../storage/compile-session-repository.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

type PreflightHost = "cli" | "claude" | "codex" | "opencode";
type Framework = "plain" | "gsd" | "superpowers" | "gstack";
type PreflightAction = "ask" | "compile" | "skip";

interface PreflightPayload {
  action: PreflightAction;
  host: PreflightHost;
  framework: Framework;
  rawInput: string;
  questions: string[];
  resolvedSlots: Partial<Record<SlotName, string>>;
  compiledPrompt: string;
  usedHistoryIds: string[];
}

export async function runPreflightCommand(args: string[], context: CliContext): Promise<number> {
  const options = parsePreflightArgs(args);
  if (!options.rawInput) {
    context.stderr('usage: prompt preflight "<raw input>" [--host cli|claude|codex|opencode] [--json]');
    return 1;
  }

  const policy = await readProjectPolicy(context.cwd);
  if (!policy.enabled) {
    return outputPayload(
      {
        action: "skip",
        host: options.host,
        framework: options.framework,
        rawInput: options.rawInput,
        questions: [],
        resolvedSlots: {},
        compiledPrompt: "",
        usedHistoryIds: []
      },
      options.json,
      context
    );
  }

  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);
  const compileSessionRepository = new CompileSessionRepository(database);

  try {
    const profile = profileRepository.load("global");
    const historyMatches = retrievePromptEntries(promptRepository, options.rawInput, 3);
    const snippets = historyMatches.map((row) => row.promptText);
    const decision = compileOrClarify(options.rawInput, profile.inferred, snippets);
    const usedHistoryIds = historyMatches.map((row) => row.id);

    if (decision.kind === "questions") {
      compileSessionRepository.save({
        rawInput: options.rawInput,
        compiledPrompt: "",
        followUpQuestions: decision.followUpQuestions,
        resolvedSlots: decision.resolvedSlots,
        targetFramework: options.framework,
        targetHost: options.host,
        usedHistoryIds
      });

      return outputPayload(
        {
          action: "ask",
          host: options.host,
          framework: options.framework,
          rawInput: options.rawInput,
          questions: decision.followUpQuestions,
          resolvedSlots: decision.resolvedSlots,
          compiledPrompt: "",
          usedHistoryIds
        },
        options.json,
        context
      );
    }

    const compiledPrompt = renderForFramework(
      options.framework,
      options.rawInput,
      decision.text,
      snippets
    );

    compileSessionRepository.save({
      rawInput: options.rawInput,
      compiledPrompt,
      followUpQuestions: [],
      resolvedSlots: decision.resolvedSlots,
      targetFramework: options.framework,
      targetHost: options.host,
      usedHistoryIds
    });

    return outputPayload(
      {
        action: "compile",
        host: options.host,
        framework: options.framework,
        rawInput: options.rawInput,
        questions: [],
        resolvedSlots: decision.resolvedSlots,
        compiledPrompt,
        usedHistoryIds
      },
      options.json,
      context
    );
  } finally {
    database.close();
  }
}

function outputPayload(payload: PreflightPayload, json: boolean, context: CliContext): number {
  if (json) {
    context.stdout(JSON.stringify(payload));
    return 0;
  }

  if (payload.action === "skip") {
    context.stdout("prompt checks disabled for this project");
    return 0;
  }

  if (payload.action === "ask") {
    context.stdout(`Prompt Skill needs more context:\n- ${payload.questions.join("\n- ")}`);
    return 0;
  }

  context.stdout(`Prompt Skill Context\n${payload.compiledPrompt}`);
  return 0;
}

function renderForFramework(
  framework: Framework,
  rawInput: string,
  compiledPrompt: string,
  historySnippets: string[]
): string {
  if (framework === "gsd") {
    return renderGsdContext({ rawInput, compiledPrompt, historySnippets });
  }

  if (framework === "superpowers") {
    return renderSuperpowersBrief({ rawInput, compiledPrompt, historySnippets });
  }

  if (framework === "gstack") {
    return renderGstackBrief({ rawInput, compiledPrompt, historySnippets });
  }

  return compiledPrompt;
}

function parsePreflightArgs(args: string[]): {
  rawInput: string;
  host: PreflightHost;
  framework: Framework;
  json: boolean;
} {
  const inputParts: string[] = [];
  let host: PreflightHost = "cli";
  let framework: Framework = "plain";
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--host") {
      const candidate = args[index + 1];
      host = parseHost(candidate) ?? host;
      index += 1;
      continue;
    }

    if (value === "--framework") {
      const candidate = args[index + 1];
      framework = parseFramework(candidate) ?? framework;
      index += 1;
      continue;
    }

    inputParts.push(value);
  }

  return {
    rawInput: inputParts.join(" ").trim(),
    host,
    framework,
    json
  };
}

function parseHost(value: string | undefined): PreflightHost | null {
  return value === "cli" || value === "claude" || value === "codex" || value === "opencode"
    ? value
    : null;
}

function parseFramework(value: string | undefined): Framework | null {
  return value === "plain" || value === "gsd" || value === "superpowers" || value === "gstack"
    ? value
    : null;
}
