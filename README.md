# Briefsmith

[English](README.md) | [简体中文](README.zh-CN.md)

> Briefsmith is a request compiler and preflight gate for AI coding agents.

Stop letting coding agents guess what "optimize this" means.

Briefsmith sits between a human request and hosts like Codex, Claude Code, and OpenCode. When the request is under-specified, it decides whether to ask, compile, or skip before execution starts.

## Why It Exists

Most agent failures start before the model writes a single token:

- the request is missing a clear target
- success criteria are implicit
- constraints are unstated
- output expectations are fuzzy
- verification is never defined

That is not a wording problem. It is an execution-readiness problem.

Briefsmith uses local prompt history, inferred preferences, and project policy to reduce ambiguity before the coding agent acts.

## What Briefsmith Tries To Resolve

Before execution, Briefsmith tries to make these fields explicit:

- `target`
- `success_criteria`
- `constraints`
- `verification`
- `output_format`

## Core Decision: `ask / compile / skip`

| Action | What it means |
| --- | --- |
| `ask` | Critical execution detail is still missing, so the host should ask a small follow-up question |
| `compile` | Enough context exists to generate a stronger coding brief |
| `skip` | Prompt checks are disabled for the current project |

## Core Workflow

```text
human request
-> slot detection
-> history / profile / policy enrichment
-> ask / compile / skip
-> coding agent execution
```

## What The Product Is

Briefsmith is not the product because it can store prompts, tag prompts, or show favorites.

The product is the preflight decision:

- should the agent ask before it acts?
- can the request be compiled into a stronger brief?
- does local context already explain what the user likely means?

History, profile, policy, and adapters exist to support that decision.

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
briefsmith preflight "optimize this import flow without changing external behavior" --host codex --json
```

If you want better local signal first:

```bash
briefsmith import
briefsmith profile refresh
```

### Install Host Adapters

```bash
briefsmith adapters install all --scope project
briefsmith adapters doctor
```

## How `preflight` Works

`preflight` is the main runtime entrypoint.

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

## Supporting Systems

| Supporting system | Why it exists |
| --- | --- |
| `import` / `reindex` / `find` / `show` / favorites / tags | Give `preflight` reusable local history instead of forcing the host to guess |
| `profile refresh` | Infer recurring user preferences that can stabilize future briefs |
| `policy` / `start` / `stop` | Control when Briefsmith should ask, compile, or stay out of the way |
| `adapters` | Install Briefsmith into Claude Code, Codex, and OpenCode without hand-editing host files |

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

### Core Preflight

```bash
briefsmith preflight "optimize this import flow" --host codex --json
briefsmith compile "optimize this import flow without changing external behavior" --framework superpowers
briefsmith compile latest
briefsmith compile history
briefsmith compile show <compile-session-id>
```

### Supporting Context

```bash
briefsmith import
briefsmith reindex
briefsmith find "optimize"
briefsmith show <prompt-id>
briefsmith star <prompt-id>
briefsmith unstar <prompt-id>
briefsmith favorites list
briefsmith tags add <prompt-id> <tag>
briefsmith tags remove <prompt-id> <tag>
briefsmith tags list <prompt-id>
```

### Host Integration And Diagnostics

```bash
briefsmith adapters list
briefsmith adapters install all --scope project
briefsmith adapters doctor
briefsmith doctor
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
