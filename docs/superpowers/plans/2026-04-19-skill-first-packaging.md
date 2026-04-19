# Skill-First Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `.agents/skills/prompt-memory` the canonical skill source, derive host artifacts from it, and add one-command adapter installation with automatic build checks.

**Architecture:** Add a host-side renderer module that reads the canonical skill and produces Codex/Claude/OpenCode artifacts. Keep host installers focused on writing files safely. Add a runtime build guard before adapter installation and extend the CLI with `install all`.

**Tech Stack:** TypeScript, Node.js built-ins, node:test, existing CLI/host installer structure

---

### Task 1: Add canonical skill renderers

**Files:**
- Create: `src/host/prompt-memory-skill.ts`
- Modify: `templates/codex/AGENTS.snippet.md`
- Modify: `templates/codex/SKILL.md`
- Modify: `templates/claude/SKILL.md`
- Modify: `templates/opencode/prompt-memory.md`
- Test: `tests/host/prompt-memory-skill.test.ts`

- [x] **Step 1: Write failing renderer tests**
- [x] **Step 2: Run the renderer tests and confirm they fail**
- [x] **Step 3: Implement canonical skill loading and host-specific render functions**
- [x] **Step 4: Update template snapshots to match renderer output**
- [x] **Step 5: Re-run renderer tests and confirm they pass**

### Task 2: Move installers onto canonical renderers

**Files:**
- Modify: `src/host/codex/install.ts`
- Modify: `src/host/claude/install.ts`
- Modify: `src/host/opencode/install.ts`
- Modify: `tests/host/codex.test.ts`
- Modify: `tests/host/claude.test.ts`
- Modify: `tests/host/opencode.test.ts`

- [x] **Step 1: Write failing installer tests for canonical skill usage**
- [x] **Step 2: Run the targeted installer tests and confirm they fail**
- [x] **Step 3: Replace template-loader usage with renderer usage**
- [x] **Step 4: Re-run the targeted installer tests and confirm they pass**

### Task 3: Add runtime build guard

**Files:**
- Create: `src/host/runtime-build.ts`
- Test: `tests/host/runtime-build.test.ts`

- [x] **Step 1: Write failing tests for build-skip, build-trigger, and missing-package failure**
- [x] **Step 2: Run the targeted runtime-build tests and confirm they fail**
- [x] **Step 3: Implement runtime artifact checking and build invocation**
- [x] **Step 4: Re-run the targeted runtime-build tests and confirm they pass**

### Task 4: Add `prompt adapters install all`

**Files:**
- Modify: `src/cli/commands/adapters.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/adapters.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write a failing CLI test for `adapters install all`**
- [x] **Step 2: Run the targeted CLI test and confirm it fails**
- [x] **Step 3: Implement `install all` and wire in the runtime build guard**
- [x] **Step 4: Update help text and README command examples**
- [x] **Step 5: Re-run the targeted CLI test and confirm it passes**

### Task 5: Full verification

**Files:**
- Verify only

- [x] **Step 1: Run the full test suite**
- [x] **Step 2: Run the specific host and CLI tests again if needed to inspect failures**
- [x] **Step 3: Review git diff for accidental unrelated changes**
