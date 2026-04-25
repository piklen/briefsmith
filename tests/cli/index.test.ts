import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLI_NAME } from "../../src/cli/command-name.js";
import { isCliEntrypoint, runCli } from "../../src/cli/index.js";

test("runCli prints top-level help when no args are given", async () => {
  const output: string[] = [];

  const exitCode = await runCli([], {
    cwd: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("Core Preflight")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} preflight`) && line.includes("#")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} demo preflight`) && line.includes("#")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} import`) && line.includes("#")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} doctor`) && line.includes("#")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} adapters doctor [claude|codex|opencode]`)), true);
});

test("runCli prints top-level help for --help and -h", async () => {
  for (const flag of ["--help", "-h"]) {
    const output: string[] = [];
    const exitCode = await runCli([flag], {
      cwd: process.cwd(),
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line),
    });

    assert.equal(exitCode, 0);
    assert.equal(output.some((line) => line.includes("Preflight human requests before your coding agent guesses what they mean.")), true);
    assert.equal(output.some((line) => line.includes("Host Integration")), true);
    assert.equal(output.some((line) => line.includes(`${CLI_NAME} compile`) && line.includes("#")), true);
  }
});

test("runCli prints top-level help for help alias", async () => {
  const output: string[] = [];
  const exitCode = await runCli(["help"], {
    cwd: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes("Tips")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} preflight "optimize this import flow" --host codex --json`) && line.includes("#")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} demo preflight`) && line.includes("#")), true);
});

test("runCli compile rejects unsupported frameworks instead of silently using plain output", async () => {
  const output: string[] = [];
  const exitCode = await runCli(["compile", "optimize this import flow", "--framework", "markdown"], {
    cwd: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(output.some((line) => line.includes("unsupported framework: markdown")), true);
});

test("runCli suggests --help when command is unknown", async () => {
  const output: string[] = [];
  const exitCode = await runCli(["wat"], {
    cwd: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(output.some((line) => line.includes("Unknown command: wat")), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} --help`)), true);
});

test("isCliEntrypoint treats a symlinked bin path as the CLI entrypoint", () => {
  const targetPath = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url));
  const tempDir = mkdtempSync(join(tmpdir(), "briefsmith-cli-link-"));
  const symlinkPath = join(tempDir, "briefsmith");
  symlinkSync(targetPath, symlinkPath);

  assert.equal(isCliEntrypoint(symlinkPath, new URL("../../src/cli/index.ts", import.meta.url).href), true);
});
