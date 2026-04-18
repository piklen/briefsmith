import { join } from "node:path";
import { databasePath, globalDataDir } from "../../config/paths.js";
import type { CliContext, DoctorCheck } from "../../core/types.js";
import { pathExists, walkFiles } from "../../utils/filesystem.js";

export function summarizeDoctorChecks(checks: DoctorCheck[]): string {
  return checks.map((check) => `[${check.status}] ${check.name}: ${check.detail}`).join("\n");
}

export async function runDoctorCommand(context: CliContext): Promise<number> {
  const dataDir = globalDataDir(context.homeDir);
  const checks: DoctorCheck[] = [
    {
      name: "node-version",
      status: "ok",
      detail: process.version
    },
    {
      name: "data-dir",
      status: (await pathExists(dataDir)) ? "ok" : "warn",
      detail: dataDir
    },
    {
      name: "database",
      status: (await pathExists(databasePath(dataDir))) ? "ok" : "warn",
      detail: databasePath(dataDir)
    }
  ];

  const sources = [
    { name: "claude", root: join(context.homeDir, ".claude", "projects"), pattern: ".jsonl" },
    { name: "codex", root: join(context.homeDir, ".codex"), pattern: ".jsonl" },
    { name: "opencode", root: join(context.homeDir, ".local", "share", "opencode", "storage", "message"), pattern: ".json" },
    { name: "gemini-history", root: join(context.homeDir, ".gemini", "history"), pattern: ".json" },
    { name: "gemini-tmp", root: join(context.homeDir, ".gemini", "tmp"), pattern: ".json" }
  ];

  for (const source of sources) {
    const exists = await pathExists(source.root);
    const files = exists ? await walkFiles(source.root, (path) => path.includes(source.pattern)) : [];
    checks.push({
      name: `${source.name}-source`,
      status: exists ? "ok" : "warn",
      detail: exists ? `${files.length} candidate files under ${source.root}` : `missing: ${source.root}`
    });
  }

  context.stdout(summarizeDoctorChecks(checks));
  return checks.some((check) => check.status === "fail") ? 1 : 0;
}
