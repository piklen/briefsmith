import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../../utils/filesystem.js";
import type { HostDoctorResult, InstallScope } from "../base.js";

export async function doctorClaudeAdapter(
  projectRoot: string,
  homeDir: string,
  scope: InstallScope
): Promise<HostDoctorResult> {
  const baseDir = scope === "global" ? join(homeDir, ".claude") : join(projectRoot, ".claude");
  const settingsPath = join(baseDir, "settings.json");
  const skillPath = join(baseDir, "skills", "prompt-memory", "SKILL.md");
  const checks: HostDoctorResult["checks"] = [];

  const settingsExists = await pathExists(settingsPath);
  if (settingsExists) {
    const text = await readFile(settingsPath, "utf8");
    checks.push({
      name: "settings",
      status: text.includes("hook-entry.js") ? "ok" : "warn",
      detail: settingsPath
    });
  } else {
    checks.push({
      name: "settings",
      status: "warn",
      detail: `missing: ${settingsPath}`
    });
  }

  const skillExists = await pathExists(skillPath);
  checks.push({
    name: "skill",
    status: skillExists ? "ok" : "warn",
    detail: skillExists ? skillPath : `missing: ${skillPath}`
  });

  return {
    adapter: "claude",
    scope,
    status: checks.every((check) => check.status === "ok") ? "ok" : "warn",
    checks
  };
}
