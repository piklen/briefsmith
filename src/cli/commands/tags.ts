import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { Database } from "../../storage/database.js";
import { PromptRepository } from "../../storage/prompt-repository.js";
import { CLI_NAME } from "../command-name.js";

export async function runTagsCommand(args: string[], context: CliContext): Promise<number> {
  const [subcommand, id, tag] = args;
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new PromptRepository(database);

  try {
    switch (subcommand) {
      case "add": {
        if (!id || !tag) {
          context.stderr(`usage: ${CLI_NAME} tags add <id> <tag>`);
          return 1;
        }
        const prompt = repository.addTag(id, tag);
        if (!prompt) {
          context.stderr(`prompt not found: ${id}`);
          return 1;
        }
        context.stdout(`tags for ${id}: ${prompt.tags.join(", ")}`);
        return 0;
      }
      case "remove": {
        if (!id || !tag) {
          context.stderr(`usage: ${CLI_NAME} tags remove <id> <tag>`);
          return 1;
        }
        const prompt = repository.removeTag(id, tag);
        if (!prompt) {
          context.stderr(`prompt not found: ${id}`);
          return 1;
        }
        context.stdout(`tags for ${id}: ${prompt.tags.join(", ") || "(none)"}`);
        return 0;
      }
      case "list": {
        if (!id) {
          context.stderr(`usage: ${CLI_NAME} tags list <id>`);
          return 1;
        }
        const prompt = repository.getById(id);
        if (!prompt) {
          context.stderr(`prompt not found: ${id}`);
          return 1;
        }
        if (prompt.tags.length === 0) {
          context.stdout("(no tags)");
          return 0;
        }
        for (const existingTag of prompt.tags) {
          context.stdout(existingTag);
        }
        return 0;
      }
      default:
        context.stderr(`usage: ${CLI_NAME} tags <add|remove|list> ...`);
        return 1;
    }
  } finally {
    database.close();
  }
}
