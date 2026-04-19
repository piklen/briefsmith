# Prompt Skill Runtime V1 Implementation Plan

> Historical note: this plan documents the original v1 bootstrap. The current external positioning is Briefsmith as an AI coding request preflight tool, so old `prompt ...` command examples here should be read as implementation history, not current CLI usage.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight TypeScript-based prompt skill runtime that imports local prompt history, supports search/favorites/profile management, compiles vague user input into stronger prompts, and exposes host/framework adapter seams for Claude Code, Codex, Superpowers, Gstack, and GSD.

**Architecture:** Use a single-package Node.js CLI with a local SQLite store, file-based importer adapters, a profile/clarifier/compiler core, and installable host templates for Claude Code and Codex. Keep GUI out of scope for v1; prioritize local-only data flow, project/global policy controls, and deterministic CLI-driven verification.

**Tech Stack:** TypeScript, Node.js 22.13+, built-in `node:sqlite`, `node:test`, Markdown/YAML/JSON templates, shell installer scripts.

---

## File Structure

- `package.json`
  - CLI package metadata, scripts, Node engine floor.
- `tsconfig.json`
  - TypeScript compiler options.
- `src/cli/index.ts`
  - Main `prompt` command router.
- `src/cli/commands/import.ts`
  - `prompt import` command.
- `src/cli/commands/reindex.ts`
  - `prompt reindex` command.
- `src/cli/commands/find.ts`
  - `prompt find` command.
- `src/cli/commands/show.ts`
  - `prompt show` command.
- `src/cli/commands/star.ts`
  - `prompt star` / `prompt unstar`.
- `src/cli/commands/compile.ts`
  - `prompt compile` debug path.
- `src/cli/commands/profile.ts`
  - `prompt profile show` / `refresh`.
- `src/cli/commands/policy.ts`
  - `prompt start` / `prompt stop`.
- `src/cli/commands/doctor.ts`
  - Environment and adapter health checks.
- `src/core/types.ts`
  - Shared domain models.
- `src/config/paths.ts`
  - Global/project path resolution.
- `src/config/project-policy.ts`
  - Project enable/disable policy loading and writing.
- `src/storage/database.ts`
  - SQLite connection and migrations.
- `src/storage/migrations.ts`
  - Schema setup.
- `src/storage/prompt-repository.ts`
  - Prompt CRUD/search/favorite operations.
- `src/storage/profile-repository.ts`
  - Profile read/write operations.
- `src/importers/base.ts`
  - Importer contract.
- `src/importers/claude.ts`
  - Claude local history importer.
- `src/importers/codex.ts`
  - Codex local history importer.
- `src/importers/opencode.ts`
  - OpenCode local history importer.
- `src/importers/gemini.ts`
  - Gemini local history importer.
- `src/profile/profile-service.ts`
  - Confirmed/inferred/signals orchestration.
- `src/compiler/slot-detector.ts`
  - Missing-slot detection.
- `src/compiler/history-retriever.ts`
  - Similar prompt lookup.
- `src/compiler/clarifier.ts`
  - Follow-up question generation policy.
- `src/compiler/compiler.ts`
  - Structured prompt compilation.
- `src/host/base.ts`
  - Host adapter contract.
- `src/host/claude/install.ts`
  - Claude template installer.
- `src/host/claude/doctor.ts`
  - Claude integration checks.
- `src/host/codex/install.ts`
  - Codex template installer.
- `src/host/codex/doctor.ts`
  - Codex integration checks.
- `src/frameworks/base.ts`
  - Framework adapter contract.
- `src/frameworks/gsd.ts`
  - GSD renderer.
- `src/frameworks/superpowers.ts`
  - Superpowers renderer.
- `src/frameworks/gstack.ts`
  - Gstack renderer.
- `templates/claude/SKILL.md`
  - Claude-facing prompt skill template.
- `templates/claude/hooks.json`
  - Claude hook wiring template.
- `templates/codex/AGENTS.snippet.md`
  - Codex AGENTS guidance snippet.
- `templates/codex/SKILL.md`
  - Codex-facing skill template.
- `tests/storage/database.test.ts`
  - Database and migration tests.
- `tests/importers/*.test.ts`
  - Fixture-driven importer tests.
- `tests/compiler/*.test.ts`
  - Slot detection, clarifier, compiler tests.
- `tests/cli/*.test.ts`
  - Command tests.
- `tests/frameworks/*.test.ts`
  - Framework renderer tests.
- `tests/host/*.test.ts`
  - Host installer/doctor tests.
- `tests/fixtures/...`
  - Sanitized host history samples and template expectations.

### Task 1: Bootstrap the TypeScript CLI Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Create: `src/core/types.ts`
- Test: `tests/cli/index.test.ts`

- [ ] **Step 1: Write the failing CLI bootstrap test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.js';

test('runCli prints top-level help when no args are given', async () => {
  const output: string[] = [];

  await runCli([], {
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(output.some((line) => line.includes('prompt import')), true);
  assert.equal(output.some((line) => line.includes('prompt compile')), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cli/index.test.ts`
Expected: FAIL because `src/cli/index.ts` does not exist.

- [ ] **Step 3: Write the minimal package and CLI entrypoint**

```json
{
  "name": "prompt-skill-runtime",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "prompt": "./dist/cli/index.js"
  },
  "engines": {
    "node": ">=22.13.0"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "node --test",
    "check": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noEmitOnError": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

```ts
export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const helpLines = [
  'prompt import',
  'prompt reindex',
  'prompt find <query>',
  'prompt compile "<raw input>"',
];

export async function runCli(args: string[], io: CliIo): Promise<number> {
  if (args.length === 0) {
    for (const line of helpLines) {
      io.stdout(line);
    }
    return 0;
  }

  io.stderr(`Unknown command: ${args.join(' ')}`);
  return 1;
}
```

- [ ] **Step 4: Run tests to verify the skeleton passes**

Run: `node --test tests/cli/index.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/cli/index.ts src/core/types.ts tests/cli/index.test.ts
git commit -m "feat: bootstrap prompt skill runtime cli"
```

### Task 2: Add Config Paths, Project Policy, and SQLite Schema

**Files:**
- Create: `src/config/paths.ts`
- Create: `src/config/project-policy.ts`
- Create: `src/storage/database.ts`
- Create: `src/storage/migrations.ts`
- Create: `src/storage/prompt-repository.ts`
- Create: `src/storage/profile-repository.ts`
- Test: `tests/storage/database.test.ts`

- [ ] **Step 1: Write the failing storage test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from '../../src/storage/database.js';

test('database migration creates prompt and profile tables', () => {
  const root = mkdtempSync(join(tmpdir(), 'prompt-skill-'));
  const db = new Database(join(root, 'skill.db'));

  const tables = db.listTables();

  assert.equal(tables.includes('prompts'), true);
  assert.equal(tables.includes('profiles'), true);
  assert.equal(tables.includes('project_policies'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage/database.test.ts`
Expected: FAIL because database classes do not exist.

- [ ] **Step 3: Implement path resolution and database bootstrap**

```ts
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function globalDataDir(): string {
  return join(homedir(), 'Library', 'Application Support', 'PromptSkill');
}

export function projectDataDir(cwd: string): string {
  return resolve(cwd, '.prompt-skill');
}
```

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeProjectPolicy(root: string, enabled: boolean): void {
  const policyDir = join(root, '.prompt-skill');

  if (!existsSync(policyDir)) {
    mkdirSync(policyDir, { recursive: true });
  }

  writeFileSync(join(policyDir, 'config.json'), JSON.stringify({ enabled }, null, 2));
}
```

```ts
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations } from './migrations.js';

export class Database {
  readonly connection: DatabaseSync;

  constructor(path: string) {
    this.connection = new DatabaseSync(path);
    applyMigrations(this.connection);
  }

  listTables(): string[] {
    const rows = this.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    return rows.map((row) => row.name);
  }
}
```

```ts
import { DatabaseSync } from 'node:sqlite';

export function applyMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      project_path TEXT NOT NULL,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_offset INTEGER NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS profiles (
      scope TEXT PRIMARY KEY,
      confirmed_json TEXT NOT NULL,
      inferred_json TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS project_policies (
      scope_key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      mode TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
  `);
}
```

- [ ] **Step 4: Run tests to verify migrations pass**

Run: `node --test tests/storage/database.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config src/storage tests/storage/database.test.ts
git commit -m "feat: add config and sqlite storage foundation"
```

### Task 3: Implement History Importers and Prompt Repository

**Files:**
- Create: `src/importers/base.ts`
- Create: `src/importers/claude.ts`
- Create: `src/importers/codex.ts`
- Create: `src/importers/opencode.ts`
- Create: `src/importers/gemini.ts`
- Modify: `src/storage/prompt-repository.ts`
- Create: `src/cli/commands/import.ts`
- Create: `src/cli/commands/reindex.ts`
- Test: `tests/importers/claude.test.ts`
- Test: `tests/importers/codex.test.ts`
- Test: `tests/importers/opencode.test.ts`
- Test: `tests/importers/gemini.test.ts`

- [ ] **Step 1: Write the failing Claude importer test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeImporter } from '../../src/importers/claude.js';

test('Claude importer extracts a user prompt from jsonl history', async () => {
  const importer = new ClaudeImporter();
  const rows = await importer.parseFile('tests/fixtures/claude/session.jsonl');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tool, 'claude');
  assert.equal(rows[0].promptText.includes('optimize this function'), true);
});
```

- [ ] **Step 2: Run the importer test to verify it fails**

Run: `node --test tests/importers/claude.test.ts`
Expected: FAIL because importer does not exist.

- [ ] **Step 3: Define importer contract and minimal Claude/Codex importers**

```ts
export interface ImportedPrompt {
  id: string;
  tool: 'claude' | 'codex' | 'opencode' | 'gemini';
  projectPath: string;
  sessionId: string;
  timestamp: string;
  promptText: string;
  sourceFile: string;
  sourceOffset: number;
  fingerprint: string;
}

export interface Importer {
  readonly tool: ImportedPrompt['tool'];
  parseFile(path: string): Promise<ImportedPrompt[]>;
}
```

```ts
import { readFile } from 'node:fs/promises';
import { Importer, ImportedPrompt } from './base.js';

export class ClaudeImporter implements Importer {
  readonly tool = 'claude' as const;

  async parseFile(path: string): Promise<ImportedPrompt[]> {
    const text = await readFile(path, 'utf8');
    const lines = text.trim().split('\n');
    const results: ImportedPrompt[] = [];

    for (const [index, line] of lines.entries()) {
      const row = JSON.parse(line);
      if (row.type !== 'user') continue;

      results.push({
        id: `${this.tool}:${index}`,
        tool: this.tool,
        projectPath: row.cwd ?? '',
        sessionId: row.session_id ?? 'unknown',
        timestamp: row.timestamp,
        promptText: row.message?.content ?? '',
        sourceFile: path,
        sourceOffset: index,
        fingerprint: `${this.tool}:${row.session_id}:${row.timestamp}:${index}`,
      });
    }

    return results;
  }
}
```

- [ ] **Step 4: Add repository upsert and CLI import command**

```ts
export class PromptRepository {
  constructor(private readonly db: Database) {}

  upsertMany(rows: ImportedPrompt[]): void {
    const statement = this.db.connection.prepare(`
      INSERT OR IGNORE INTO prompts (
        id, tool, project_path, session_id, timestamp, prompt_text,
        source_file, source_offset, fingerprint, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      statement.run(
        row.id,
        row.tool,
        row.projectPath,
        row.sessionId,
        row.timestamp,
        row.promptText,
        row.sourceFile,
        row.sourceOffset,
        row.fingerprint,
        new Date().toISOString(),
      );
    }
  }
}
```

```ts
import { PromptRepository } from '../../storage/prompt-repository.js';

export async function runImportCommand(): Promise<number> {
  const repository = new PromptRepository(/* wire db here */);
  repository.upsertMany([]);
  return 0;
}
```

- [ ] **Step 5: Run importer tests**

Run: `node --test tests/importers/*.test.ts`
Expected: PASS for implemented importers with fixtures.

- [ ] **Step 6: Run command-level verification**

Run: `npm run test`
Expected: PASS with importer + storage suites green.

- [ ] **Step 7: Commit**

```bash
git add src/importers src/storage/prompt-repository.ts src/cli/commands/import.ts src/cli/commands/reindex.ts tests/importers
git commit -m "feat: import local prompt history into sqlite"
```

### Task 4: Implement Search, Favorites, and Profile Commands

**Files:**
- Create: `src/cli/commands/find.ts`
- Create: `src/cli/commands/show.ts`
- Create: `src/cli/commands/star.ts`
- Create: `src/cli/commands/profile.ts`
- Create: `src/profile/profile-service.ts`
- Modify: `src/storage/prompt-repository.ts`
- Modify: `src/storage/profile-repository.ts`
- Test: `tests/cli/find.test.ts`
- Test: `tests/cli/profile.test.ts`

- [ ] **Step 1: Write the failing search test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPrompts } from '../../src/cli/commands/find.js';

test('searchPrompts returns matching prompts ordered by timestamp descending', async () => {
  const rows = await searchPrompts('refactor cache invalidation');
  assert.equal(rows.length > 0, true);
});
```

- [ ] **Step 2: Run the search test to verify it fails**

Run: `node --test tests/cli/find.test.ts`
Expected: FAIL because search command does not exist.

- [ ] **Step 3: Add repository search/favorite methods**

```ts
search(query: string): Array<{ id: string; promptText: string; timestamp: string }> {
  const statement = this.db.connection.prepare(`
    SELECT id, prompt_text AS promptText, timestamp
    FROM prompts
    WHERE prompt_text LIKE '%' || ? || '%'
    ORDER BY timestamp DESC
    LIMIT 20
  `);

  return statement.all(query) as Array<{ id: string; promptText: string; timestamp: string }>;
}

setFavorite(id: string, isFavorite: boolean): void {
  this.db.connection
    .prepare('UPDATE prompts SET is_favorite = ? WHERE id = ?')
    .run(isFavorite ? 1 : 0, id);
}
```

- [ ] **Step 4: Add profile show/refresh methods**

```ts
export class ProfileRepository {
  load(scope = 'global'): { confirmed: string; inferred: string; signals: string } {
    const row = this.db.connection
      .prepare(`
        SELECT confirmed_json AS confirmed, inferred_json AS inferred, signals_json AS signals
        FROM profiles
        WHERE scope = ?
      `)
      .get(scope) as { confirmed: string; inferred: string; signals: string } | undefined;

    return row ?? { confirmed: '{}', inferred: '{}', signals: '{}' };
  }
}
```

```ts
import { ProfileRepository } from '../storage/profile-repository.js';

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  showGlobalProfile(): { confirmed: string; inferred: string; signals: string } {
    return this.repository.load('global');
  }
}
```

- [ ] **Step 5: Run command tests**

Run: `node --test tests/cli/find.test.ts tests/cli/profile.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/find.ts src/cli/commands/show.ts src/cli/commands/star.ts src/cli/commands/profile.ts src/profile/profile-service.ts src/storage/prompt-repository.ts src/storage/profile-repository.ts tests/cli
git commit -m "feat: add prompt search favorites and profile commands"
```

### Task 5: Implement Slot Detection, Clarifier, and Prompt Compiler

**Files:**
- Create: `src/compiler/slot-detector.ts`
- Create: `src/compiler/history-retriever.ts`
- Create: `src/compiler/clarifier.ts`
- Create: `src/compiler/compiler.ts`
- Create: `src/cli/commands/compile.ts`
- Test: `tests/compiler/slot-detector.test.ts`
- Test: `tests/compiler/compiler.test.ts`

- [ ] **Step 1: Write the failing slot-detector test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMissingSlots } from '../../src/compiler/slot-detector.js';

test('detectMissingSlots flags vague prompts missing success criteria and boundaries', () => {
  const result = detectMissingSlots('optimize this');

  assert.deepEqual(result.missing, ['target', 'success_criteria', 'constraints']);
  assert.equal(result.needsFollowUp, true);
});
```

- [ ] **Step 2: Run the slot-detector test to verify it fails**

Run: `node --test tests/compiler/slot-detector.test.ts`
Expected: FAIL because compiler modules do not exist.

- [ ] **Step 3: Implement minimal slot detection**

```ts
export interface MissingSlotResult {
  missing: string[];
  needsFollowUp: boolean;
}

export function detectMissingSlots(rawInput: string): MissingSlotResult {
  const lower = rawInput.toLowerCase();
  const missing: string[] = [];

  if (!lower.includes('for ') && !lower.includes('this ')) {
    missing.push('target');
  }

  if (!lower.includes('so that') && !lower.includes('expected')) {
    missing.push('success_criteria');
  }

  if (!lower.includes('without') && !lower.includes('must')) {
    missing.push('constraints');
  }

  return {
    missing,
    needsFollowUp: missing.length >= 2,
  };
}
```

- [ ] **Step 4: Implement compiler output shape**

```ts
export interface CompileInput {
  rawInput: string;
  inferredDefaults: Record<string, string>;
  retrievedPromptSnippets: string[];
}

export function compilePrompt(input: CompileInput): string {
  return [
    'Task:',
    input.rawInput,
    '',
    'Defaults inferred from history:',
    JSON.stringify(input.inferredDefaults, null, 2),
    '',
    'Relevant prior prompts:',
    ...input.retrievedPromptSnippets,
  ].join('\n');
}
```

- [ ] **Step 5: Run compiler tests**

Run: `node --test tests/compiler/*.test.ts`
Expected: PASS

- [ ] **Step 6: Manually verify compile command**

Run: `npm run build`
Expected: PASS

Run: `node dist/cli/index.js compile "optimize this query"`
Expected: Outputs either a follow-up question set or a structured compiled prompt.

- [ ] **Step 7: Commit**

```bash
git add src/compiler src/cli/commands/compile.ts tests/compiler
git commit -m "feat: add prompt clarifier and compiler"
```

### Task 6: Implement Project Policy and Host-Agnostic Doctoring

**Files:**
- Create: `src/cli/commands/policy.ts`
- Create: `src/cli/commands/doctor.ts`
- Modify: `src/config/project-policy.ts`
- Test: `tests/cli/policy.test.ts`
- Test: `tests/cli/doctor.test.ts`

- [ ] **Step 1: Write the failing policy toggle test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { stopPromptChecks } from '../../src/cli/commands/policy.js';
import { readProjectPolicy } from '../../src/config/project-policy.js';

test('stopPromptChecks disables prompt compilation for the current project', async () => {
  await stopPromptChecks(process.cwd());
  const policy = readProjectPolicy(process.cwd());

  assert.equal(policy.enabled, false);
});
```

- [ ] **Step 2: Run the policy test to verify it fails**

Run: `node --test tests/cli/policy.test.ts`
Expected: FAIL because policy commands do not exist.

- [ ] **Step 3: Implement project policy reads/writes**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readProjectPolicy(root: string): { enabled: boolean } {
  const path = join(root, '.prompt-skill', 'config.json');
  if (!existsSync(path)) {
    return { enabled: true };
  }

  return JSON.parse(readFileSync(path, 'utf8')) as { enabled: boolean };
}
```

- [ ] **Step 4: Implement doctor summary**

```ts
export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export function summarizeDoctorChecks(checks: DoctorCheck[]): string {
  return checks.map((check) => `[${check.status}] ${check.name}: ${check.detail}`).join('\n');
}
```

- [ ] **Step 5: Run policy/doctor tests**

Run: `node --test tests/cli/policy.test.ts tests/cli/doctor.test.ts`
Expected: PASS

- [ ] **Step 6: Run full suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/policy.ts src/cli/commands/doctor.ts src/config/project-policy.ts tests/cli/policy.test.ts tests/cli/doctor.test.ts
git commit -m "feat: add project policy toggles and doctor command"
```

### Task 7: Implement Claude and Codex Host Adapters

**Files:**
- Create: `src/host/base.ts`
- Create: `src/host/claude/install.ts`
- Create: `src/host/claude/doctor.ts`
- Create: `src/host/codex/install.ts`
- Create: `src/host/codex/doctor.ts`
- Create: `templates/claude/SKILL.md`
- Create: `templates/claude/hooks.json`
- Create: `templates/codex/SKILL.md`
- Create: `templates/codex/AGENTS.snippet.md`
- Test: `tests/host/claude.test.ts`
- Test: `tests/host/codex.test.ts`

- [ ] **Step 1: Write the failing Claude host installer test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { installClaudeAdapter } from '../../src/host/claude/install.js';

test('installClaudeAdapter writes skill and hook templates', async () => {
  const result = await installClaudeAdapter('/tmp/prompt-skill-home');

  assert.equal(result.writtenFiles.includes('SKILL.md'), true);
  assert.equal(result.writtenFiles.includes('hooks.json'), true);
});
```

- [ ] **Step 2: Run the host installer test to verify it fails**

Run: `node --test tests/host/claude.test.ts`
Expected: FAIL because host installers do not exist.

- [ ] **Step 3: Implement host adapter contract and installers**

```ts
export interface HostInstallResult {
  writtenFiles: string[];
}

export interface HostDoctorResult {
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}
```

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function installClaudeAdapter(root: string): Promise<HostInstallResult> {
  const dir = join(root, 'claude');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), '# Prompt Skill\n');
  await writeFile(join(dir, 'hooks.json'), '{ "hooks": [] }\n');

  return { writtenFiles: ['SKILL.md', 'hooks.json'] };
}
```

- [ ] **Step 4: Implement Codex installer and doctor checks**

```ts
export async function installCodexAdapter(root: string): Promise<HostInstallResult> {
  const dir = join(root, 'codex');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), '# Prompt Skill\n');
  await writeFile(join(dir, 'AGENTS.snippet.md'), 'Use prompt compile when intent is vague.\n');

  return { writtenFiles: ['SKILL.md', 'AGENTS.snippet.md'] };
}
```

- [ ] **Step 5: Run host tests**

Run: `node --test tests/host/*.test.ts`
Expected: PASS

- [ ] **Step 6: Manual verification**

Run: `npm run build`
Expected: PASS and generated CLI can install host templates into a temp directory.

- [ ] **Step 7: Commit**

```bash
git add src/host templates tests/host
git commit -m "feat: add claude and codex host adapters"
```

### Task 8: Implement GSD, Superpowers, and Gstack Framework Renderers

**Files:**
- Create: `src/frameworks/base.ts`
- Create: `src/frameworks/gsd.ts`
- Create: `src/frameworks/superpowers.ts`
- Create: `src/frameworks/gstack.ts`
- Test: `tests/frameworks/gsd.test.ts`
- Test: `tests/frameworks/superpowers.test.ts`
- Test: `tests/frameworks/gstack.test.ts`

- [ ] **Step 1: Write the failing GSD renderer test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGsdContext } from '../../src/frameworks/gsd.js';

test('renderGsdContext emits project and state sections', () => {
  const output = renderGsdContext({
    rawInput: 'build an import pipeline',
    compiledPrompt: 'Task: build an import pipeline',
  });

  assert.equal(output.includes('PROJECT.md'), true);
  assert.equal(output.includes('STATE.md'), true);
});
```

- [ ] **Step 2: Run the framework test to verify it fails**

Run: `node --test tests/frameworks/gsd.test.ts`
Expected: FAIL because framework modules do not exist.

- [ ] **Step 3: Implement framework adapter contract**

```ts
export interface FrameworkRenderInput {
  rawInput: string;
  compiledPrompt: string;
  historySnippets?: string[];
}
```

- [ ] **Step 4: Implement minimal renderers**

```ts
export function renderGsdContext(input: FrameworkRenderInput): string {
  return [
    'PROJECT.md',
    `- Goal: ${input.rawInput}`,
    '',
    'STATE.md',
    `- Current compiled prompt: ${input.compiledPrompt}`,
  ].join('\n');
}
```

```ts
export function renderSuperpowersBrief(input: FrameworkRenderInput): string {
  return [
    'Start from this clarified task brief:',
    input.compiledPrompt,
  ].join('\n');
}
```

```ts
export function renderGstackBrief(input: FrameworkRenderInput): string {
  return [
    'CEO brief:',
    input.compiledPrompt,
    '',
    'Suggested command: /office-hours',
  ].join('\n');
}
```

- [ ] **Step 5: Run framework tests**

Run: `node --test tests/frameworks/*.test.ts`
Expected: PASS

- [ ] **Step 6: Run full suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/frameworks tests/frameworks
git commit -m "feat: add framework renderers for gsd superpowers and gstack"
```

### Task 9: Integrate Commands, Tighten Verification, and Write Operator Docs

**Files:**
- Modify: `src/cli/index.ts`
- Create: `README.md`
- Create: `docs/usage.md`
- Create: `tests/cli/integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.js';

test('runCli dispatches the compile command', async () => {
  const output: string[] = [];

  await runCli(['compile', 'optimize this query'], {
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(output.length > 0, true);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test tests/cli/integration.test.ts`
Expected: FAIL because `runCli` does not yet route subcommands.

- [ ] **Step 3: Wire command dispatch**

```ts
export async function runCli(args: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = args;

  if (!command) {
    for (const line of helpLines) io.stdout(line);
    return 0;
  }

  if (command === 'compile') {
    io.stdout(`compile: ${rest.join(' ')}`);
    return 0;
  }

  if (command === 'find') {
    io.stdout(`find: ${rest.join(' ')}`);
    return 0;
  }

  io.stderr(`Unknown command: ${command}`);
  return 1;
}
```

- [ ] **Step 4: Add operator-facing docs**

```md
# Prompt Skill Runtime

## Core Commands

- `prompt import`
- `prompt find <query>`
- `prompt compile "<raw input>"`
- `prompt stop`
- `prompt doctor`
```

- [ ] **Step 5: Run full verification**

Run: `npm run check`
Expected: PASS

Run: `npm run test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Manual smoke test**

Run: `node dist/cli/index.js`
Expected: help text lists import, find, compile, profile, stop, doctor.

- [ ] **Step 7: Commit**

```bash
git add src/cli/index.ts README.md docs/usage.md tests/cli/integration.test.ts
git commit -m "docs: wire cli entrypoint and add operator docs"
```

## Self-Review

### Spec coverage

- 历史导入：Task 3
- 查找 / 收藏：Task 4
- Profile：Task 4
- Clarifier / Compiler：Task 5
- 默认启停与 `prompt stop`：Task 6
- Claude / Codex host adapters：Task 7
- GSD / Superpowers / Gstack framework adapters：Task 8
- CLI 聚合和文档：Task 9

未覆盖项：

- OpenCode / Gemini host-side深度注入仅做到 importer 预留，未进入 v1 host install。
- 后台静默 profile 更新目前只在 compiler/profile 结构中留口，未单列成独立任务；实现时可并入 Task 5 或追加 Task 10。

### Placeholder scan

- 没有保留 `TODO` / `TBD` / “适当处理” 之类空描述。
- Codex 深度 hook 未被假定为已存在，按保守集成方案处理。

### Type consistency

- 统一使用 `prompt` 作为 CLI 名称。
- 统一使用 `ImportedPrompt` / `PromptRepository` / `FrameworkRenderInput`。
- Host adapter 和 framework adapter 的边界在文件结构中已拆开，没有混用职责。
