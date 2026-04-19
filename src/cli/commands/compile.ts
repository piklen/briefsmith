import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { compileOrClarify } from "../../compiler/compiler.js";
import { isContinuationOnlyRequest, shouldUseHistoryEnrichment } from "../../compiler/continuation.js";
import { retrievePromptEntries } from "../../compiler/history-retriever.js";
import { renderGsdContext } from "../../frameworks/gsd.js";
import { renderGstackBrief } from "../../frameworks/gstack.js";
import { renderSuperpowersBrief } from "../../frameworks/superpowers.js";
import { Database } from "../../storage/database.js";
import { CompileSessionRepository } from "../../storage/compile-session-repository.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";
import { CLI_NAME } from "../command-name.js";

type Framework = "plain" | "gsd" | "superpowers" | "gstack";

export async function runCompileCommand(
  rawInput: string,
  context: CliContext,
  framework: Framework = "plain"
): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);
  const compileSessionRepository = new CompileSessionRepository(database);

  try {
    const profile = profileRepository.load("global");
    const continuationSlots = isContinuationOnlyRequest(rawInput)
      ? (compileSessionRepository.latestForProject(context.cwd)?.resolvedSlots ?? {})
      : {};
    const historyMatches = shouldUseHistoryEnrichment(rawInput)
      ? retrievePromptEntries(promptRepository, rawInput, 3, {
          projectPath: context.cwd
        })
      : [];
    const decision = compileOrClarify(
      rawInput,
      profile.inferred,
      historyMatches.map((row) => ({
        id: row.id,
        text: row.promptText
      })),
      continuationSlots
    );
    const usedHistoryIdSet = new Set(decision.usedHistoryIds);
    const usedHistoryEntries = historyMatches.filter((row) => usedHistoryIdSet.has(row.id));
    const snippets = usedHistoryEntries.map((row) => row.promptText);

    if (decision.kind === "questions") {
      compileSessionRepository.save({
        projectPath: context.cwd,
        rawInput,
        compiledPrompt: "",
        followUpQuestions: decision.followUpQuestions,
        resolvedSlots: decision.resolvedSlots,
        targetFramework: framework,
        targetHost: "cli",
        usedHistoryIds: decision.usedHistoryIds,
        historySlotIds: decision.resolvedSlotHistoryIds
      });
      context.stdout(decision.text);
      return 0;
    }

    const compiled = decision.text;

    const output = framework === "plain"
      ? compiled
      : framework === "gsd"
        ? renderGsdContext({ rawInput, compiledPrompt: compiled, historySnippets: snippets })
        : framework === "superpowers"
          ? renderSuperpowersBrief({ rawInput, compiledPrompt: compiled, historySnippets: snippets })
          : renderGstackBrief({ rawInput, compiledPrompt: compiled, historySnippets: snippets });

    compileSessionRepository.save({
      projectPath: context.cwd,
      rawInput,
      compiledPrompt: output,
      followUpQuestions: [],
      resolvedSlots: decision.resolvedSlots,
      targetFramework: framework,
      targetHost: "cli",
      usedHistoryIds: decision.usedHistoryIds,
      historySlotIds: decision.resolvedSlotHistoryIds
    });

    context.stdout(output);
    return 0;
  } finally {
    database.close();
  }
}

export async function runCompileSessionsCommand(args: string[], context: CliContext): Promise<number> {
  const [subcommand, id] = args;
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new CompileSessionRepository(database);

  try {
    if (subcommand === "latest") {
      const latest = repository.latest();
      if (!latest) {
        context.stdout("no compile sessions");
        return 0;
      }

      printCompileSession(latest, context);
      return 0;
    }

    if (subcommand === "history") {
      const sessions = repository.list();
      if (sessions.length === 0) {
        context.stdout("no compile sessions");
        return 0;
      }

      for (const session of sessions) {
        context.stdout(`${session.id} | ${session.targetFramework} | ${session.createdAt} | ${session.rawInput}`);
      }
      return 0;
    }

    if (subcommand === "show" && id) {
      const session = repository.getById(id);
      if (!session) {
        context.stderr(`compile session not found: ${id}`);
        return 1;
      }
      printCompileSession(session, context);
      return 0;
    }

    context.stderr(`usage: ${CLI_NAME} compile <latest|history|show <id>|"<raw input>">`);
    return 1;
  } finally {
    database.close();
  }
}

function printCompileSession(
  session: {
    id: string;
    rawInput: string;
    compiledPrompt: string;
    followUpQuestions: string[];
    resolvedSlots: Record<string, string>;
    targetFramework: string;
    targetHost: string;
    usedHistoryIds: string[];
    historySlotIds: Record<string, string>;
    createdAt: string;
  },
  context: CliContext
): void {
  context.stdout(`Compile Session: ${session.id}`);
  context.stdout(`Created At: ${session.createdAt}`);
  context.stdout(`Framework: ${session.targetFramework}`);
  context.stdout(`Host: ${session.targetHost}`);
  context.stdout(`Raw Input: ${session.rawInput}`);
  if (session.usedHistoryIds.length > 0) {
    context.stdout(`Used History IDs: ${session.usedHistoryIds.join(", ")}`);
  }
  const historySlots = Object.entries(session.historySlotIds);
  if (historySlots.length > 0) {
    context.stdout(`History Slot IDs: ${historySlots.map(([slot, id]) => `${slot}=${id}`).join(" | ")}`);
  }
  if (session.followUpQuestions.length > 0) {
    context.stdout(`Follow-up Questions: ${session.followUpQuestions.join(" | ")}`);
  }
  const resolved = Object.entries(session.resolvedSlots);
  if (resolved.length > 0) {
    context.stdout(`Resolved Slots: ${resolved.map(([key, value]) => `${key}=${value}`).join(" | ")}`);
  }
  if (session.compiledPrompt.length > 0) {
    context.stdout(session.compiledPrompt);
  }
}
