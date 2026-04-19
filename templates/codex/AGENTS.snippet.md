__PROMPT_SKILL_START__
## Prompt Memory Runtime

Use the prompt-memory skill to turn vague user requests into an executable task brief before acting.

# Prompt Memory

## When to Use

- The user says something vague like "optimize this", "fix it", or "make it better"
- The user wants to recover or reuse an older prompt
- The current request is missing target, success criteria, constraints, or output format
- The task would benefit from local prompt history before execution

## Core Job

Turn rough user intent into an executable task brief without inventing missing facts.

## What to Do

1. Check whether the request is missing target, success criteria, constraints, or output format.
2. Search local prompt history when the user refers to earlier prompts or recurring task patterns.
3. Reuse stable constraints from project instructions and explicit user boundaries.
4. If missing context would materially change execution quality, ask only the smallest set of follow-up questions needed.
5. If enough context is available, proceed with a clearer internal task brief instead of the raw user wording.

## Boundaries

- Do not invent facts the user did not provide.
- Preserve explicit boundaries such as "不要改外部行为" and "keep API unchanged".
- Prefer minimal follow-up questions over long clarification checklists.

## Codex Runtime Integration

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force preflight.
2. Use `node dist/src/cli/index.js preflight "<raw input>" --host codex --json` when the request is vague or under-specified.
3. If `action` is `ask`, ask only the returned follow-up questions before executing.
4. If `action` is `compile`, treat `compiledPrompt` as additional execution context before you act.
5. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover an older prompt.
__PROMPT_SKILL_END__
