import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, pathExists } from "../../utils/filesystem.js";
import type { HostInstallOptions, HostInstallResult } from "../base.js";
import { readBundledTemplate } from "../template-loader.js";

interface ClaudeSettings {
  hooks?: Record<string, Array<{ matcher?: string; hooks: Array<Record<string, unknown>> }>>;
  [key: string]: unknown;
}

export async function installClaudeAdapter(options: Omit<HostInstallOptions, "homeDir"> & { homeDir?: string }): Promise<HostInstallResult> {
  const scope = options.scope;
  const runtimeRoot = options.runtimeRoot ?? options.projectRoot;
  const baseDir = scope === "global"
    ? join(options.homeDir ?? options.projectRoot, ".claude")
    : join(options.projectRoot, ".claude");

  const settingsPath = join(baseDir, "settings.json");
  const skillPath = join(baseDir, "skills", "prompt-memory", "SKILL.md");
  const writtenFiles: string[] = [];

  await ensureDir(join(baseDir, "skills", "prompt-memory"));

  const settings = await loadClaudeSettings(settingsPath);
  const hooks = settings.hooks ?? {};
  const userPromptSubmit = hooks.UserPromptSubmit ?? [];
  const command = scope === "project"
    ? 'node "$CLAUDE_PROJECT_DIR/dist/src/host/claude/hook-entry.js"'
    : `node "${join(runtimeRoot, "dist", "src", "host", "claude", "hook-entry.js")}"`;

  const alreadyInstalled = JSON.stringify(userPromptSubmit).includes("hook-entry.js");
  if (!alreadyInstalled) {
    userPromptSubmit.push({
      hooks: [
        {
          type: "command",
          command
        }
      ]
    });
  }

  settings.hooks = {
    ...hooks,
    UserPromptSubmit: userPromptSubmit
  };

  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  writtenFiles.push(settingsPath);

  await writeFile(skillPath, await readClaudeSkillTemplate(), "utf8");
  writtenFiles.push(skillPath);

  return {
    adapter: "claude",
    scope,
    writtenFiles,
    notes: [
      "Claude adapter installed with a UserPromptSubmit hook.",
      "Use /hooks inside Claude Code to verify the hook is loaded."
    ]
  };
}

async function loadClaudeSettings(settingsPath: string): Promise<ClaudeSettings> {
  if (!(await pathExists(settingsPath))) {
    return {};
  }

  const text = await readFile(settingsPath, "utf8");
  return JSON.parse(text) as ClaudeSettings;
}

async function readClaudeSkillTemplate(): Promise<string> {
  return readBundledTemplate("templates/claude/SKILL.md", import.meta.url);
}
