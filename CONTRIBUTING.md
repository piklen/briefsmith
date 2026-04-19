# Contributing

Thanks for contributing to Prompt Skill Runtime.

## Development Setup

```bash
npm install
npm run build
```

Runtime requirements:

- Node.js `>= 22.13.0`
- npm `>= 10`

## Before Opening a Pull Request

Run the full local verification set:

```bash
npm test
npm run check
npm run build
```

## Contribution Guidelines

- Keep changes scoped to the task at hand.
- Preserve explicit user constraints such as `不要改外部行为` and `keep API unchanged`.
- Prefer extending the canonical skill in `.agents/skills/prompt-memory/` instead of editing host templates by hand.
- If you change host packaging behavior, update the corresponding tests under `tests/host/` and `tests/cli/`.
- If you change product positioning or install behavior, update `README.md` and the relevant spec/plan docs.

## Pull Request Notes

- Explain the user-visible behavior change.
- Call out any host-specific impact for `Codex`, `Claude`, or `OpenCode`.
- Include the exact verification commands you ran.
