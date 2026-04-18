---
name: prompt-memory
description: Use when the user request is vague, references prior prompts, or would benefit from searching local prompt history before execution.
---

# Prompt Memory

## When to Use

- The user gives an under-specified instruction
- The user wants to recover or reuse a previous prompt
- The current request likely needs historical prompt context

## What to Do

1. Use `node dist/src/cli/index.js find "<query>"` to search prompt history.
2. Use `node dist/src/cli/index.js preflight "<raw input>" --host codex --json` when the request is vague.
3. If `action` is `ask`, ask the returned questions before executing.
4. If `action` is `compile`, use `compiledPrompt` as additional task context before executing.
5. Ask follow-up questions only when the missing information changes execution quality.
