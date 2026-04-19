# Briefsmith

[English](README.md) | [简体中文](README.zh-CN.md)

> A prompt quality gate that turns vague user requests into executable task briefs for AI coding hosts.

Briefsmith helps hosts like Codex, Claude Code, and OpenCode decide what to do with under-specified user input before execution starts.

Instead of blindly acting on requests like "optimize this", Briefsmith tries to answer:

1. Is the request already executable with high confidence?
2. Can local prompt history, profile inference, and project policy fill the missing context?
3. If not, what is the minimum follow-up question the host should ask?

That makes Briefsmith an execution preflight layer, not just a prompt rewriter.

## Why

Weak AI output often comes from weak task framing, not weak models.

Typical failure mode:

- the user gives a vague instruction
- the host guesses the intended target or constraints
- important boundaries get lost
- the output looks reasonable but solves the wrong problem

Briefsmith reduces that gap by using local context before execution.

## Core Workflow

```text
local prompt history
-> retrieval and reuse
-> profile inference
-> project policy check
-> ask / compile / skip
-> host AI execution
```

## What It Does

| Capability | Purpose |
| --- | --- |
| `import` / `find` / `show` / favorites / tags | Turn local prompt history into reusable context |
| `profile refresh` | Infer recurring user preferences from prior prompts |
| `compile` | Convert raw intent into a stronger task brief |
| `preflight` | Decide whether the host should ask, compile, or skip |
| `policy` / `start` / `stop` | Control project-level behavior and confidence thresholds |
| `adapters` | Install host-facing integration for Claude Code, Codex, and OpenCode |

Packaging rules:

- [`.agents/skills/prompt-memory/SKILL.md`](.agents/skills/prompt-memory/SKILL.md) is the canonical skill source
- `templates/*` are derived host snapshots, not the primary source
- `briefsmith adapters install <host>` auto-builds runtime artifacts when required

## Quick Start

### Install

```bash
npm install -g briefsmith
briefsmith --help
```

One-off usage:

```bash
npx briefsmith --help
```

### Run The Main Flow

```bash
briefsmith import
briefsmith profile refresh
briefsmith preflight "optimize this import flow without changing external behavior" --host codex --json
```

### Install Host Adapters

```bash
briefsmith adapters install all --scope project
briefsmith adapters doctor
```

## How `preflight` Works

`preflight` is the main runtime entrypoint for host adapters.

It can return three actions:

| Action | Meaning |
| --- | --- |
| `ask` | Critical execution detail is still missing |
| `compile` | Enough context exists to generate a stronger brief |
| `skip` | Prompt checks are disabled for the current project |

Example:

```bash
briefsmith preflight "optimize this import flow" --host codex --json
```

Key response fields:

| Field | Meaning |
| --- | --- |
| `action` | `ask`, `compile`, or `skip` |
| `questions` | Follow-up questions for the host to ask |
| `compiledPrompt` | Generated task brief when action is `compile` |
| `resolvedSlots` | Task slots filled during enrichment |
| `usedHistoryIds` | Historical prompts used as evidence |
| `evidence` | Why Briefsmith made the decision |

Most useful evidence fields:

| Evidence Field | Meaning |
| --- | --- |
| `policyMode` | Current project policy mode |
| `initialMissingSlots` | What was missing before enrichment |
| `unresolvedSlots` | What is still missing after enrichment |
| `lowConfidenceSlots` | Filled slots still below threshold |
| `historyMatchCount` | Number of matching historical prompts |
| `resolvedSlotSources` | Where each resolved slot came from |
| `resolvedSlotConfidence` | Confidence score for each resolved slot |

## Host Adapters

| Host | Integration Shape |
| --- | --- |
| Claude Code | Project-level `.claude/settings.json` hook plus canonical skill install |
| Codex | Managed block in `AGENTS.md` or global Codex skill install |
| OpenCode | Project-level `.opencode/prompt-memory.md` or global `~/.config/opencode/prompt-memory.md` instructions |

Commands:

```bash
briefsmith adapters list
briefsmith adapters install claude --scope project
briefsmith adapters install codex --scope project
briefsmith adapters install opencode --scope project
briefsmith adapters doctor
```

## Project Policy

Project policy lives at:

```text
.prompt-skill/config.json
```

Example:

```json
{
  "enabled": true,
  "mode": "suggest",
  "hostConfidenceThresholds": {
    "codex": 0.6,
    "opencode": 0.8
  },
  "hostSlotConfidenceThresholds": {
    "codex": {
      "success_criteria": 0.55
    }
  }
}
```

Policy modes:

| Mode | Behavior |
| --- | --- |
| `off` | Disable prompt checks for the current project |
| `suggest` | Ask follow-up questions when confidence is too low |
| `auto-compile` | Always compile, but still keep low-confidence evidence |

Useful commands:

```bash
briefsmith policy show
briefsmith policy mode suggest
briefsmith policy threshold codex 0.62
briefsmith policy threshold codex success_criteria 0.58
briefsmith start
briefsmith stop
```

## CLI Overview

### Retrieval And History

```bash
briefsmith import
briefsmith find "optimize"
briefsmith show <prompt-id>
briefsmith star <prompt-id>
briefsmith unstar <prompt-id>
briefsmith favorites list
briefsmith tags add <prompt-id> <tag>
briefsmith tags remove <prompt-id> <tag>
briefsmith tags list <prompt-id>
```

### Profile And Compilation

```bash
briefsmith profile show
briefsmith profile refresh
briefsmith compile "optimize this import flow without changing external behavior" --framework superpowers
briefsmith compile latest
briefsmith compile history
briefsmith compile show <compile-session-id>
briefsmith preflight "optimize this import flow" --host codex --json
```

### Health Checks

```bash
briefsmith doctor
briefsmith adapters doctor
```

Supported framework renderers:

- `plain`
- `superpowers`
- `gsd`
- `gstack`

## Local Development

Requirements:

- Node.js `>= 22.13.0`
- npm `>= 10`

Validated locally during development:

- Node.js `v25.9.0`
- npm `11.12.1`

Install and run locally:

```bash
npm install
npm run build
node dist/src/cli/index.js --help
```

Verification:

```bash
npm test
npm run check
npm run build
npm run pack:check
```

## Data Storage

Default macOS data directory:

```text
~/Library/Application Support/PromptSkill/
```

Files currently written:

- `skill.db`

## Release Workflow

This repository uses Changesets for versioning and npm release management.

Contributor flow:

```bash
npm run changeset
```

Maintainer flow:

1. Merge feature PRs with changesets into `main`
2. GitHub Actions opens or updates a version PR
3. Merge the version PR to publish to npm and create git tags
4. The release workflow serializes publishes so only one `main` release runs at a time

Required GitHub secret:

- `NPM_TOKEN`

## Boundaries

- reads only locally persisted session or log data
- does not use keyboard interception
- does not use Accessibility input capture
- does not use screen OCR
- does not sync to the cloud
- Gemini currently supports only parseable structured JSON or JSONL history

## Docs And Project Files

- Product positioning: [`docs/superpowers/specs/2026-04-19-prompt-quality-gate-positioning-design.md`](docs/superpowers/specs/2026-04-19-prompt-quality-gate-positioning-design.md)
- Runtime design: [`docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md`](docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md)
- License: [`LICENSE`](LICENSE)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security: [`SECURITY.md`](SECURITY.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
