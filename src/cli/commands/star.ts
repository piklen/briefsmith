import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runStarCommand(id: string, favorite: boolean, context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);

  try {
    const updated = repository.setFavorite(id, favorite);
    if (!updated) {
      context.stderr(`prompt not found: ${id}`);
      return 1;
    }

    context.stdout(`${favorite ? "starred" : "unstarred"} ${id}`);
    return 0;
  } finally {
    database.close();
  }
}
