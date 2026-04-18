import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runFavoritesCommand(args: string[], context: CliContext): Promise<number> {
  const [subcommand] = args;
  if (subcommand !== "list") {
    context.stderr("usage: prompt favorites list");
    return 1;
  }

  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);

  try {
    const favorites = repository.favorites();
    if (favorites.length === 0) {
      context.stdout("no favorite prompts");
      return 0;
    }

    for (const favorite of favorites) {
      context.stdout(`${favorite.id} | ${favorite.tool} | ${favorite.timestamp} | ${favorite.promptText}`);
    }

    return 0;
  } finally {
    database.close();
  }
}
