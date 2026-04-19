import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../src/cli/index.js";

test("runCli lists supported adapters", async () => {
  const output: string[] = [];
  const exitCode = await runCli(["adapters", "list"], {
    cwd: process.cwd(),
    homeDir: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("claude")), true);
  assert.equal(output.some((line) => line.includes("codex")), true);
  assert.equal(output.some((line) => line.includes("opencode")), true);
});

test("runCli installs all supported adapters for the current project", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-adapters-"));
  mkdirSync(join(root, "dist", "src", "cli"), { recursive: true });
  mkdirSync(join(root, "dist", "src", "host", "claude"), { recursive: true });
  writeFileSync(join(root, "dist", "src", "cli", "index.js"), "");
  writeFileSync(join(root, "dist", "src", "host", "claude", "hook-entry.js"), "");

  const output: string[] = [];
  const exitCode = await runCli(["adapters", "install", "all"], {
    cwd: root,
    homeDir: root,
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("installed claude adapter")), true);
  assert.equal(output.some((line) => line.includes("installed codex adapter")), true);
  assert.equal(output.some((line) => line.includes("installed opencode adapter")), true);
  assert.equal(existsSync(join(root, "AGENTS.md")), true);
  assert.equal(existsSync(join(root, ".claude", "settings.json")), true);
  assert.equal(existsSync(join(root, ".claude", "skills", "prompt-memory", "SKILL.md")), true);
  assert.equal(existsSync(join(root, ".opencode", "prompt-memory.md")), true);
});
