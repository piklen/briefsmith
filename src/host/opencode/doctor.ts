import { join } from "node:path";
import { pathExists } from "../../utils/filesystem.js";
import type { HostDoctorResult, InstallScope } from "../base.js";

export async function doctorOpenCodeAdapter(
  projectRoot: string,
  homeDir: string,
  scope: InstallScope
): Promise<HostDoctorResult> {
  const instructionsPath = scope === "global"
    ? join(homeDir, ".config", "opencode", "prompt-memory.md")
    : join(projectRoot, ".opencode", "prompt-memory.md");
  const exists = await pathExists(instructionsPath);

  return {
    adapter: "opencode",
    scope,
    status: exists ? "ok" : "warn",
    checks: [
      {
        name: scope === "global" ? "global-instructions" : "project-instructions",
        status: exists ? "ok" : "warn",
        detail: exists ? instructionsPath : `missing: ${instructionsPath}`
      }
    ]
  };
}
