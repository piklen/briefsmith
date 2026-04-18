import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../../utils/filesystem.js";
import type { HostDoctorResult, InstallScope } from "../base.js";

export async function doctorCodexAdapter(
  projectRoot: string,
  homeDir: string,
  scope: InstallScope
): Promise<HostDoctorResult> {
  if (scope === "global") {
    const skillPath = join(homeDir, ".codex", "skills", "prompt-memory", "SKILL.md");
    const exists = await pathExists(skillPath);
    return {
      adapter: "codex",
      scope,
      status: exists ? "ok" : "warn",
      checks: [
        {
          name: "global-skill",
          status: exists ? "ok" : "warn",
          detail: exists ? skillPath : `missing: ${skillPath}`
        }
      ]
    };
  }

  const agentsPath = join(projectRoot, "AGENTS.md");
  const exists = await pathExists(agentsPath);
  const content = exists ? await readFile(agentsPath, "utf8") : "";
  const installed = content.includes("prompt-skill:start");

  return {
    adapter: "codex",
    scope,
    status: installed ? "ok" : "warn",
    checks: [
      {
        name: "agents-block",
        status: installed ? "ok" : "warn",
        detail: installed ? agentsPath : `missing managed prompt-skill block in ${agentsPath}`
      }
    ]
  };
}
