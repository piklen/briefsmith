import test from "node:test";
import assert from "node:assert/strict";
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
});
