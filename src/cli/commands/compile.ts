import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { compileOrClarify, compilePrompt } from "../../compiler/compiler.js";
import { retrievePromptSnippets } from "../../compiler/history-retriever.js";
import { renderGsdContext } from "../../frameworks/gsd.js";
import { renderGstackBrief } from "../../frameworks/gstack.js";
import { renderSuperpowersBrief } from "../../frameworks/superpowers.js";
import { Database } from "../../storage/database.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

type Framework = "plain" | "gsd" | "superpowers" | "gstack";

export async function runCompileCommand(
  rawInput: string,
  context: CliContext,
  framework: Framework = "plain"
): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);

  try {
    const profile = profileRepository.load("global");
    const snippets = retrievePromptSnippets(promptRepository, rawInput);
    const decision = compileOrClarify(rawInput, profile.inferred, snippets);

    if (decision.kind === "questions") {
      context.stdout(decision.text);
      return 0;
    }

    const compiled = compilePrompt({
      rawInput,
      inferredDefaults: profile.inferred,
      followUpAnswers: {},
      retrievedPromptSnippets: snippets
    });

    const output = framework === "plain"
      ? compiled
      : framework === "gsd"
        ? renderGsdContext({ rawInput, compiledPrompt: compiled, historySnippets: snippets })
        : framework === "superpowers"
          ? renderSuperpowersBrief({ rawInput, compiledPrompt: compiled, historySnippets: snippets })
          : renderGstackBrief({ rawInput, compiledPrompt: compiled, historySnippets: snippets });

    context.stdout(output);
    return 0;
  } finally {
    database.close();
  }
}
