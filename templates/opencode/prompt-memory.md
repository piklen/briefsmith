# Prompt Memory for OpenCode

Use the canonical prompt-memory skill plus Briefsmith preflight before acting on vague AI coding requests.

# Prompt Memory

## When to Use

- The user says something vague like "optimize this", "fix it", or "make it better"
- The user wants to recover or reuse an older prompt
- The current request is missing target, problem signals, success criteria, constraints, or output format
- The task would benefit from local prompt history before execution

## Core Job

Preflight rough AI coding requests: ask when key execution details are missing, compile when enough local context exists, and never invent missing facts.

## What to Do

1. Check whether the request is missing target, problem signals, success criteria, constraints, output format, or verification.
2. Search local prompt history when the user refers to earlier prompts or recurring task patterns.
3. Reuse stable constraints from project instructions and explicit user boundaries.
4. If missing context would materially change execution quality, ask only the smallest set of follow-up questions needed.
5. If enough context is available, compile a clearer execution brief instead of acting on the raw user wording.

## Boundaries

- Do not invent facts the user did not provide.
- Preserve explicit boundaries such as "不要改外部行为" and "keep API unchanged".
- Prefer minimal follow-up questions over long clarification checklists.
- Do not turn every vague request into a longer prompt if one small question would be safer.

## OpenCode Runtime Integration

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force preflight.
2. Use `node dist/src/cli/index.js preflight "<raw input>" --host opencode --json` when the request is vague or under-specified.
3. If `action` is `ask`, ask only the returned follow-up questions before executing.
4. If `action` is `compile`, treat `compiledPrompt` as additional execution context before you act.
5. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover an older prompt.
