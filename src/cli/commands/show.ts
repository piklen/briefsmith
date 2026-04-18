import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runShowCommand(id: string, context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);

  try {
    const row = repository.getById(id);
    if (!row) {
      context.stderr(`prompt not found: ${id}`);
      return 1;
    }

    context.stdout(JSON.stringify(row, null, 2));
    return 0;
  } finally {
    database.close();
  }
}
