import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installCodexAdapter } from "../../src/host/codex/install.js";

test("installCodexAdapter writes a managed AGENTS block without overwriting existing content", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-codex-"));
  writeFileSync(join(root, "AGENTS.md"), "# Existing Rules\n\nKeep tests focused.\n");

  const result = await installCodexAdapter({
    projectRoot: root,
    homeDir: root,
    scope: "project"
  });

  assert.equal(result.writtenFiles.some((file) => file.endsWith("AGENTS.md")), true);

  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.equal(agents.includes("# Existing Rules"), true);
  assert.equal(agents.includes("prompt-skill:start"), true);
  assert.equal(agents.includes("node dist/src/cli/index.js compile"), true);
});

test("installCodexAdapter can install a global skill template", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-codex-"));

  const result = await installCodexAdapter({
    projectRoot: root,
    homeDir: root,
    scope: "global"
  });

  assert.equal(
    result.writtenFiles.some((file) => file.endsWith(".codex/skills/prompt-memory/SKILL.md")),
    true
  );
});
