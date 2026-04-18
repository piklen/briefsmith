__PROMPT_SKILL_START__
## Prompt Skill Runtime

When the user request is vague, under-specified, or refers to earlier good prompts:

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force prompt compilation.
2. Use `node dist/src/cli/index.js compile "<raw input>"` to turn a vague request into a clearer task brief.
3. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover a previous prompt.
4. Keep follow-up questions minimal and only ask for missing constraints that materially change the result.
5. Preserve explicit user boundaries like "不要改外部行为" or "keep API unchanged".
__PROMPT_SKILL_END__
