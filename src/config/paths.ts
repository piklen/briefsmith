import { join, resolve } from "node:path";

export function globalDataDir(homeDir: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") {
    return join(homeDir, "Library", "Application Support", "PromptSkill");
  }

  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return join(xdgDataHome, "PromptSkill");
  }

  return join(homeDir, ".local", "share", "PromptSkill");
}

export function databasePath(dataDir: string): string {
  return join(dataDir, "skill.db");
}

export function projectDataDir(cwd: string): string {
  return resolve(cwd, ".prompt-skill");
}
