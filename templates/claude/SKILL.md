---
name: prompt-memory
description: Use when the user request is vague, references previous prompts, or needs historical prompt retrieval before execution.
---

# Prompt Memory

## When to Use

- The user says something vague like "optimize this" or "fix it"
- The user wants to find an old prompt or reuse an earlier request
- The task needs historical prompt context before execution

## What to Do

1. Check whether the request is missing target, success criteria, or constraints.
2. Use the local prompt runtime to search history when relevant.
3. If context is still missing, ask only the smallest set of questions needed.
4. Preserve project boundaries and avoid changing behavior the user marked as fixed.
