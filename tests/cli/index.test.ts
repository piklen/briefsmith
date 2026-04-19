import test from "node:test";
import assert from "node:assert/strict";
import { CLI_NAME } from "../../src/cli/command-name.js";
import { runCli } from "../../src/cli/index.js";

test("runCli prints top-level help when no args are given", async () => {
  const output: string[] = [];

  const exitCode = await runCli([], {
    cwd: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} import`)), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} compile`)), true);
  assert.equal(output.some((line) => line.includes(`${CLI_NAME} doctor`)), true);
});
