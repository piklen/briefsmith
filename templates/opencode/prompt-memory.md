---
name: prompt-memory
description: Use when an OpenCode request is vague, references prior prompts, or would benefit from local prompt history before execution.
---

# Prompt Memory for OpenCode

## When to Use

- The user gives an under-specified instruction.
- The user asks to recover or reuse a previous prompt.
- The current request likely needs local prompt history or user-style context.

## What to Do

1. Respect `.prompt-skill/config.json`; if prompt checks are disabled, do not force preflight.
2. Run `node dist/src/cli/index.js preflight "<raw input>" --host opencode --json`.
3. If `action` is `ask`, ask only the returned questions.
4. If `action` is `compile`, use `compiledPrompt` as additional task context.
5. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover an older prompt.

## Boundaries

- Read only local persisted prompt history.
- Do not add keyboard listeners, Accessibility input capture, OCR, or cloud sync.
- Preserve explicit user constraints such as "不要改外部行为" and "keep API unchanged".
