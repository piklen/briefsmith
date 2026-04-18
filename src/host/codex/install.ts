import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, pathExists } from "../../utils/filesystem.js";
import type { HostInstallOptions, HostInstallResult } from "../base.js";
import { readBundledTemplate } from "../template-loader.js";

const START_MARKER = "<!-- prompt-skill:start -->";
const END_MARKER = "<!-- prompt-skill:end -->";

export async function installCodexAdapter(options: HostInstallOptions): Promise<HostInstallResult> {
  if (options.scope === "global") {
    return installCodexGlobalSkill(options.homeDir);
  }

  return installCodexProjectRules(options.projectRoot);
}

async function installCodexProjectRules(projectRoot: string): Promise<HostInstallResult> {
  const agentsPath = join(projectRoot, "AGENTS.md");
  const existing = (await pathExists(agentsPath)) ? await readFile(agentsPath, "utf8") : "";
  const snippet = (await readCodexAgentsTemplate())
    .replaceAll("__PROMPT_SKILL_START__", START_MARKER)
    .replaceAll("__PROMPT_SKILL_END__", END_MARKER);

  const nextContent = existing.includes(START_MARKER)
    ? replaceManagedBlock(existing, snippet)
    : [existing.trimEnd(), snippet].filter((part) => part.length > 0).join("\n\n");

  await writeFile(agentsPath, `${nextContent.trimEnd()}\n`, "utf8");

  return {
    adapter: "codex",
    scope: "project",
    writtenFiles: [agentsPath],
    notes: [
      "Codex adapter installed through a managed AGENTS.md block."
    ]
  };
}

async function installCodexGlobalSkill(homeDir: string): Promise<HostInstallResult> {
  const skillDir = join(homeDir, ".codex", "skills", "prompt-memory");
  const skillPath = join(skillDir, "SKILL.md");
  await ensureDir(skillDir);
  await writeFile(skillPath, await readCodexSkillTemplate(), "utf8");

  return {
    adapter: "codex",
    scope: "global",
    writtenFiles: [skillPath],
    notes: [
      "Global Codex skill installed under ~/.codex/skills/prompt-memory."
    ]
  };
}

function replaceManagedBlock(existing: string, snippet: string): string {
  const pattern = new RegExp(
    `${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}`,
    "g"
  );

  return existing.replace(pattern, snippet);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readCodexAgentsTemplate(): Promise<string> {
  return readBundledTemplate("templates/codex/AGENTS.snippet.md", import.meta.url);
}

async function readCodexSkillTemplate(): Promise<string> {
  return readBundledTemplate("templates/codex/SKILL.md", import.meta.url);
}
