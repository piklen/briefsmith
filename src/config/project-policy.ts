import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, pathExists } from "../utils/filesystem.js";
import { projectDataDir } from "./paths.js";

export type ProjectPolicyHost = "cli" | "claude" | "codex" | "opencode";

export const DEFAULT_HOST_CONFIDENCE_THRESHOLDS: Record<ProjectPolicyHost, number> = {
  cli: 0,
  claude: 0.65,
  codex: 0.7,
  opencode: 0.75
};

export interface ProjectPolicy {
  enabled: boolean;
  mode: "off" | "suggest" | "auto-compile";
  hostConfidenceThresholds: Record<ProjectPolicyHost, number>;
  updatedAt: string;
}

function policyPath(cwd: string): string {
  return join(projectDataDir(cwd), "config.json");
}

export async function readProjectPolicy(cwd: string): Promise<ProjectPolicy> {
  const path = policyPath(cwd);
  if (!(await pathExists(path))) {
    return defaultProjectPolicy();
  }

  const text = await readFile(path, "utf8");
  return normalizeProjectPolicy(JSON.parse(text) as Partial<ProjectPolicy>);
}

export async function writeProjectPolicy(
  cwd: string,
  policy: Pick<ProjectPolicy, "enabled" | "mode"> & Partial<Pick<ProjectPolicy, "hostConfidenceThresholds">>
): Promise<ProjectPolicy> {
  const dir = projectDataDir(cwd);
  await ensureDir(dir);
  const current = await readProjectPolicy(cwd);

  const nextPolicy = normalizeProjectPolicy({
    ...current,
    ...policy,
    hostConfidenceThresholds: {
      ...current.hostConfidenceThresholds,
      ...(policy.hostConfidenceThresholds ?? {})
    },
    updatedAt: new Date().toISOString()
  });

  await writeFile(policyPath(cwd), `${JSON.stringify(nextPolicy, null, 2)}\n`, "utf8");
  return nextPolicy;
}

function defaultProjectPolicy(): ProjectPolicy {
  return {
    enabled: true,
    mode: "suggest",
    hostConfidenceThresholds: { ...DEFAULT_HOST_CONFIDENCE_THRESHOLDS },
    updatedAt: ""
  };
}

function normalizeProjectPolicy(policy: Partial<ProjectPolicy>): ProjectPolicy {
  const defaults = defaultProjectPolicy();
  return {
    enabled: typeof policy.enabled === "boolean" ? policy.enabled : defaults.enabled,
    mode: policy.mode === "off" || policy.mode === "suggest" || policy.mode === "auto-compile"
      ? policy.mode
      : defaults.mode,
    hostConfidenceThresholds: normalizeHostConfidenceThresholds(policy.hostConfidenceThresholds),
    updatedAt: typeof policy.updatedAt === "string" ? policy.updatedAt : defaults.updatedAt
  };
}

function normalizeHostConfidenceThresholds(
  thresholds: Partial<Record<ProjectPolicyHost, number>> | undefined
): Record<ProjectPolicyHost, number> {
  return {
    cli: normalizeThreshold(thresholds?.cli, DEFAULT_HOST_CONFIDENCE_THRESHOLDS.cli),
    claude: normalizeThreshold(thresholds?.claude, DEFAULT_HOST_CONFIDENCE_THRESHOLDS.claude),
    codex: normalizeThreshold(thresholds?.codex, DEFAULT_HOST_CONFIDENCE_THRESHOLDS.codex),
    opencode: normalizeThreshold(thresholds?.opencode, DEFAULT_HOST_CONFIDENCE_THRESHOLDS.opencode)
  };
}

function normalizeThreshold(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback;
}
