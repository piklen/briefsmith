import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../../src/cli/index.js";

test("runCli demo preflight shows ask, compile, and skip scenarios without local setup", async () => {
  const output: string[] = [];

  const exitCode = await runCli(["demo", "preflight"], {
    cwd: process.cwd(),
    homeDir: process.cwd(),
    stdout: (line) => output.push(line),
    stderr: (line) => output.push(line)
  });

  const rendered = output.join("\n");

  assert.equal(exitCode, 0);
  assert.equal(rendered.includes("30-second demo"), true);
  assert.equal(rendered.includes("Scenario 1"), true);
  assert.equal(rendered.includes("Action: ask"), true);
  assert.equal(rendered.includes("Action: compile"), true);
  assert.equal(rendered.includes("Action: skip"), true);
  assert.equal(rendered.includes("fix this checkout flow"), true);
});
