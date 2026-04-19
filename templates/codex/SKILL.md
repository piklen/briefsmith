---
name: prompt-memory
description: Use when the user request is vague, under-specified, references previous prompts, or needs help turning rough intent into an executable task brief before execution.
---

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
