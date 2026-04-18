import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, pathExists } from "../utils/filesystem.js";
import { projectDataDir } from "./paths.js";

export interface ProjectPolicy {
  enabled: boolean;
  mode: "off" | "suggest" | "auto-compile";
  updatedAt: string;
}

function policyPath(cwd: string): string {
  return join(projectDataDir(cwd), "config.json");
}

export async function readProjectPolicy(cwd: string): Promise<ProjectPolicy> {
  const path = policyPath(cwd);
  if (!(await pathExists(path))) {
    return {
      enabled: true,
      mode: "suggest",
      updatedAt: ""
    };
  }

  const text = await readFile(path, "utf8");
  return JSON.parse(text) as ProjectPolicy;
}

export async function writeProjectPolicy(
  cwd: string,
  policy: Pick<ProjectPolicy, "enabled" | "mode">
): Promise<ProjectPolicy> {
  const dir = projectDataDir(cwd);
  await ensureDir(dir);

  const nextPolicy: ProjectPolicy = {
    ...policy,
    updatedAt: new Date().toISOString()
  };

  await writeFile(policyPath(cwd), `${JSON.stringify(nextPolicy, null, 2)}\n`, "utf8");
  return nextPolicy;
}
