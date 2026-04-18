import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { builtInImporters } from "../../importers/index.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runImportCommand(context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);
  let totalInserted = 0;

  try {
    for (const importer of builtInImporters()) {
      const prompts = await importer.scan(context.homeDir);
      const inserted = repository.upsertMany(prompts);
      totalInserted += inserted;
      context.stdout(`${importer.tool}: scanned ${prompts.length} prompts, inserted ${inserted}`);
    }

    context.stdout(`total prompts: ${repository.count()} (inserted ${totalInserted} this run)`);
    return 0;
  } finally {
    database.close();
  }
}
