__PROMPT_SKILL_START__
## Prompt Skill Runtime

When the user request is vague, under-specified, or refers to earlier good prompts:

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force prompt compilation.
2. Use `node dist/src/cli/index.js preflight "<raw input>" --host codex --json` to decide whether to ask follow-up questions or inject a clearer task brief.
3. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover a previous prompt.
4. If `action` is `ask`, ask the returned questions before executing.
5. If `action` is `compile`, use `compiledPrompt` as additional task context before executing.
6. Keep follow-up questions minimal and only ask for missing constraints that materially change the result.
7. Preserve explicit user boundaries like "不要改外部行为" or "keep API unchanged".
__PROMPT_SKILL_END__
