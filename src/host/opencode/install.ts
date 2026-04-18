import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir } from "../../utils/filesystem.js";
import type { HostInstallOptions, HostInstallResult } from "../base.js";
import { readBundledTemplate } from "../template-loader.js";

export async function installOpenCodeAdapter(options: HostInstallOptions): Promise<HostInstallResult> {
  if (options.scope === "global") {
    return installOpenCodeGlobalInstructions(options.homeDir);
  }

  return installOpenCodeProjectInstructions(options.projectRoot);
}

async function installOpenCodeProjectInstructions(projectRoot: string): Promise<HostInstallResult> {
  const instructionsDir = join(projectRoot, ".opencode");
  const instructionsPath = join(instructionsDir, "prompt-memory.md");
  await ensureDir(instructionsDir);
  await writeFile(instructionsPath, await readOpenCodeTemplate(), "utf8");

  return {
    adapter: "opencode",
    scope: "project",
    writtenFiles: [instructionsPath],
    notes: [
      "OpenCode adapter installed as command-first project instructions. Wire or paste this file into your OpenCode instruction setup if your client does not auto-load it."
    ]
  };
}

async function installOpenCodeGlobalInstructions(homeDir: string): Promise<HostInstallResult> {
  const instructionsDir = join(homeDir, ".config", "opencode");
  const instructionsPath = join(instructionsDir, "prompt-memory.md");
  await ensureDir(instructionsDir);
  await writeFile(instructionsPath, await readOpenCodeTemplate(), "utf8");

  return {
    adapter: "opencode",
    scope: "global",
    writtenFiles: [instructionsPath],
    notes: [
      "Global OpenCode prompt-memory instructions installed under ~/.config/opencode/prompt-memory.md."
    ]
  };
}

async function readOpenCodeTemplate(): Promise<string> {
  return readBundledTemplate("templates/opencode/prompt-memory.md", import.meta.url);
}
