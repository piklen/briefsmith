import { readFile } from "node:fs/promises";

const CANONICAL_SKILL_CANDIDATES = [
  new URL("../../.agents/skills/prompt-memory/SKILL.md", import.meta.url),
  new URL("../../../.agents/skills/prompt-memory/SKILL.md", import.meta.url)
];

export async function renderPromptMemoryCodexSkill(): Promise<string> {
  return readCanonicalPromptMemorySkill();
}

export async function renderPromptMemoryClaudeSkill(): Promise<string> {
  return readCanonicalPromptMemorySkill();
}

export async function renderPromptMemoryCodexAgentsSnippet(
  startMarker = "__PROMPT_SKILL_START__",
  endMarker = "__PROMPT_SKILL_END__"
): Promise<string> {
  const skillBody = await readCanonicalPromptMemoryBody();

  return [
    startMarker,
    "## Prompt Memory Runtime",
    "",
    "Use the prompt-memory skill to preflight vague AI coding requests before acting.",
    "",
    skillBody,
    "",
    "## Codex Runtime Integration",
    "",
    "1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force preflight.",
    "2. Use `node dist/src/cli/index.js preflight \"<raw input>\" --host codex --json` when the request is vague or under-specified.",
    "3. If `action` is `ask`, ask only the returned follow-up questions before executing.",
    "4. If `action` is `compile`, treat `compiledPrompt` as additional execution context before you act.",
    "5. Use `node dist/src/cli/index.js find \"<query>\"` when the user is trying to recover an older prompt.",
    endMarker,
    ""
  ].join("\n");
}

export async function renderPromptMemoryOpenCodeInstructions(): Promise<string> {
  const skillBody = await readCanonicalPromptMemoryBody();

  return [
    "# Prompt Memory for OpenCode",
    "",
    "Use the canonical prompt-memory skill plus Briefsmith preflight before acting on vague AI coding requests.",
    "",
    skillBody,
    "",
    "## OpenCode Runtime Integration",
    "",
    "1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force preflight.",
    "2. Use `node dist/src/cli/index.js preflight \"<raw input>\" --host opencode --json` when the request is vague or under-specified.",
    "3. If `action` is `ask`, ask only the returned follow-up questions before executing.",
    "4. If `action` is `compile`, treat `compiledPrompt` as additional execution context before you act.",
    "5. Use `node dist/src/cli/index.js find \"<query>\"` when the user is trying to recover an older prompt.",
    ""
  ].join("\n");
}

async function readCanonicalPromptMemorySkill(): Promise<string> {
  for (const candidate of CANONICAL_SKILL_CANDIDATES) {
    try {
      const text = await readFile(candidate, "utf8");
      return ensureTrailingNewline(text);
    } catch (error) {
      const typedError = error as NodeJS.ErrnoException;
      if (typedError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("Canonical prompt-memory skill not found under .agents/skills/prompt-memory/SKILL.md");
}

async function readCanonicalPromptMemoryBody(): Promise<string> {
  const skill = await readCanonicalPromptMemorySkill();
  return stripFrontmatter(skill).trim();
}

function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) {
    return markdown;
  }

  return markdown.slice(match[0].length);
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
