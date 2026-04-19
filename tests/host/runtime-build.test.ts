import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureRuntimeBuild } from "../../src/host/runtime-build.js";

test("ensureRuntimeBuild skips build when runtime artifacts already exist", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-build-"));
  mkdirSync(join(root, "dist", "src", "cli"), { recursive: true });
  mkdirSync(join(root, "dist", "src", "host", "claude"), { recursive: true });
  writeFileSync(join(root, "dist", "src", "cli", "index.js"), "");
  writeFileSync(join(root, "dist", "src", "host", "claude", "hook-entry.js"), "");

  let buildCalls = 0;
  const built = await ensureRuntimeBuild(root, async () => {
    buildCalls += 1;
  });

  assert.equal(built, false);
  assert.equal(buildCalls, 0);
});

test("ensureRuntimeBuild runs a build when runtime artifacts are missing", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-build-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { build: "echo build" } }));

  let buildCalls = 0;
  const built = await ensureRuntimeBuild(root, async (runtimeRoot) => {
    buildCalls += 1;
    mkdirSync(join(runtimeRoot, "dist", "src", "cli"), { recursive: true });
    mkdirSync(join(runtimeRoot, "dist", "src", "host", "claude"), { recursive: true });
    writeFileSync(join(runtimeRoot, "dist", "src", "cli", "index.js"), "");
    writeFileSync(join(runtimeRoot, "dist", "src", "host", "claude", "hook-entry.js"), "");
  });

  assert.equal(built, true);
  assert.equal(buildCalls, 1);
});

test("ensureRuntimeBuild fails clearly when artifacts are missing and no package.json exists", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-build-"));

  await assert.rejects(
    ensureRuntimeBuild(root, async () => {}),
    /package\.json/
  );
});
