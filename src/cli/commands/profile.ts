import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext } from "../../core/types.js";
import { ProfileService } from "../../profile/profile-service.js";
import { Database } from "../../storage/database.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

export async function runProfileShowCommand(context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const repository = new ProfileRepository(database);
  const service = new ProfileService(repository);

  try {
    context.stdout(JSON.stringify(service.showGlobalProfile(), null, 2));
    return 0;
  } finally {
    database.close();
  }
}

export async function runProfileRefreshCommand(context: CliContext): Promise<number> {
  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);
  const service = new ProfileService(profileRepository);

  try {
    const profile = service.refreshGlobalProfile(promptRepository.all(1000));
    context.stdout(JSON.stringify(profile, null, 2));
    return 0;
  } finally {
    database.close();
  }
}
