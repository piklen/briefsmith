import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runFindCommand(query: string, context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);

  try {
    const rows = repository.search(query);
    if (rows.length === 0) {
      context.stdout("no prompts found");
      return 0;
    }

    for (const row of rows) {
      context.stdout(`${row.id} | ${row.tool} | ${row.timestamp} | ${row.promptText}`);
    }

    return 0;
  } finally {
    database.close();
  }
}
