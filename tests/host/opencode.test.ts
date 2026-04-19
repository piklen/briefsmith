import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installOpenCodeAdapter } from "../../src/host/opencode/install.js";
import { renderPromptMemoryOpenCodeInstructions } from "../../src/host/prompt-memory-skill.js";

test("installOpenCodeAdapter writes project prompt-memory instructions", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-opencode-"));

  const result = await installOpenCodeAdapter({
    projectRoot: root,
    homeDir: root,
    scope: "project"
  });

  assert.equal(result.writtenFiles.some((file) => file.endsWith(".opencode/prompt-memory.md")), true);

  const content = readFileSync(join(root, ".opencode", "prompt-memory.md"), "utf8");
  assert.equal(content, await renderPromptMemoryOpenCodeInstructions());
});

test("installOpenCodeAdapter writes global prompt-memory instructions", async () => {
  const root = mkdtempSync(join(tmpdir(), "prompt-skill-opencode-"));

  const result = await installOpenCodeAdapter({
    projectRoot: root,
    homeDir: root,
    scope: "global"
  });

  assert.equal(
    result.writtenFiles.some((file) => file.endsWith(".config/opencode/prompt-memory.md")),
    true
  );
});
