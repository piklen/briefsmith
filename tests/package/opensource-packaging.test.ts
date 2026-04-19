import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

test("package.json exposes public npm metadata for an open-source package", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as Record<string, unknown>;

  assert.notEqual(pkg.private, true);
  assert.equal(pkg.name, "briefsmith");
  assert.equal(typeof pkg.description, "string");
  assert.equal(typeof pkg.license, "string");
  assert.equal(typeof pkg.repository, "object");
  assert.equal(typeof pkg.homepage, "string");
  assert.equal(typeof pkg.bugs, "object");
  assert.equal(Array.isArray(pkg.keywords), true);
  assert.equal(Array.isArray(pkg.files), true);

  const files = pkg.files as string[];
  assert.equal(files.includes("dist/src"), true);
  assert.equal(files.includes(".agents/skills/prompt-memory/SKILL.md"), true);

  const scripts = pkg.scripts as Record<string, string>;
  const bin = pkg.bin as Record<string, string>;
  assert.equal(typeof scripts.clean, "string");
  assert.equal(typeof scripts.prepack, "string");
  assert.equal(typeof scripts.changeset, "string");
  assert.equal(typeof scripts["version-packages"], "string");
  assert.equal(typeof scripts.release, "string");
  assert.equal(typeof bin.briefsmith, "string");
});

test("README does not contain workstation-specific absolute links", () => {
  const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
  assert.equal(readme.includes("/Library/Code/AI/prompt"), false);
  assert.equal(readme.includes("npm install -g briefsmith"), true);
  assert.equal(readme.includes("npx briefsmith"), true);
  assert.equal(readme.toLowerCase().includes("release workflow"), true);
});

test("repository includes bilingual README files with language selector links", () => {
  const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
  const readmeZh = readFileSync(join(REPO_ROOT, "README.zh-CN.md"), "utf8");

  assert.equal(existsSync(join(REPO_ROOT, "README.zh-CN.md")), true);
  assert.equal(readme.includes("[简体中文](README.zh-CN.md)"), true);
  assert.equal(readmeZh.includes("[English](README.md)"), true);
  assert.equal(readmeZh.includes("/Library/Code/AI/prompt"), false);
});

test("npm pack dry-run produces a minimal runtime package", () => {
  const raw = execFileSync("npm", ["pack", "--json", "--dry-run"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  const parsed = JSON.parse(raw) as Array<{ files: Array<{ path: string }> }>;
  const packedFiles = parsed[0]?.files.map((entry) => entry.path) ?? [];

  assert.equal(packedFiles.includes("dist/src/cli/index.js"), true);
  assert.equal(packedFiles.includes(".agents/skills/prompt-memory/SKILL.md"), true);
  assert.equal(packedFiles.includes("README.md"), true);
  assert.equal(packedFiles.includes("LICENSE"), true);

  for (const forbiddenPrefix of ["src/", "tests/", "docs/", ".github/", ".claude/", "templates/"]) {
    assert.equal(
      packedFiles.some((path) => path.startsWith(forbiddenPrefix)),
      false,
      `packed files should not include ${forbiddenPrefix}`
    );
  }

  assert.equal(packedFiles.includes("AGENTS.md"), false);
  assert.equal(packedFiles.includes("CONTRIBUTING.md"), false);
  assert.equal(packedFiles.includes("SECURITY.md"), false);
  assert.equal(packedFiles.includes("CODE_OF_CONDUCT.md"), false);
  assert.equal(packedFiles.includes("dist/src/host/template-loader.js"), false);
});

test("repository includes a documented release workflow", () => {
  assert.equal(existsSync(join(REPO_ROOT, ".github", "workflows", "release.yml")), true);
  assert.equal(existsSync(join(REPO_ROOT, ".changeset", "README.md")), true);
});
