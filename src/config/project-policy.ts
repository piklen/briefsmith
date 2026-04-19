import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SlotName } from "../core/types.js";
import { ensureDir, pathExists } from "../utils/filesystem.js";
import { projectDataDir } from "./paths.js";

export type ProjectPolicyHost = "cli" | "claude" | "codex" | "opencode";
const SLOT_NAMES: SlotName[] = ["target", "success_criteria", "constraints", "verification", "output_format"];

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
  hostSlotConfidenceThresholds: Record<ProjectPolicyHost, Record<SlotName, number>>;
  updatedAt: string;
}

export interface ProjectPolicyUpdate {
  enabled: boolean;
  mode: "off" | "suggest" | "auto-compile";
  hostConfidenceThresholds?: Partial<Record<ProjectPolicyHost, number>>;
  hostSlotConfidenceThresholds?: Partial<Record<ProjectPolicyHost, Partial<Record<SlotName, number>>>>;
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
  policy: ProjectPolicyUpdate
): Promise<ProjectPolicy> {
  const dir = projectDataDir(cwd);
  await ensureDir(dir);
  const current = await readProjectPolicy(cwd);

  const mergedHostConfidenceThresholds = {
    ...current.hostConfidenceThresholds,
    ...(policy.hostConfidenceThresholds ?? {})
  };
  const rebasedHostSlotConfidenceThresholds = applyHostThresholdDefaults(
    current.hostSlotConfidenceThresholds,
    mergedHostConfidenceThresholds,
    policy.hostConfidenceThresholds
  );
  const mergedHostSlotConfidenceThresholds = mergeHostSlotConfidenceThresholds(
    rebasedHostSlotConfidenceThresholds,
    policy.hostSlotConfidenceThresholds
  );

  const nextPolicy = normalizeProjectPolicy({
    ...current,
    ...policy,
    hostConfidenceThresholds: mergedHostConfidenceThresholds,
    hostSlotConfidenceThresholds: mergedHostSlotConfidenceThresholds,
    updatedAt: new Date().toISOString()
  });

  await writeFile(policyPath(cwd), `${JSON.stringify(nextPolicy, null, 2)}\n`, "utf8");
  return nextPolicy;
}

function defaultProjectPolicy(): ProjectPolicy {
  const hostConfidenceThresholds = { ...DEFAULT_HOST_CONFIDENCE_THRESHOLDS };
  return {
    enabled: true,
    mode: "suggest",
    hostConfidenceThresholds,
    hostSlotConfidenceThresholds: defaultHostSlotConfidenceThresholds(hostConfidenceThresholds),
    updatedAt: ""
  };
}

function normalizeProjectPolicy(policy: Partial<ProjectPolicy>): ProjectPolicy {
  const defaults = defaultProjectPolicy();
  const hostConfidenceThresholds = normalizeHostConfidenceThresholds(policy.hostConfidenceThresholds);
  return {
    enabled: typeof policy.enabled === "boolean" ? policy.enabled : defaults.enabled,
    mode: policy.mode === "off" || policy.mode === "suggest" || policy.mode === "auto-compile"
      ? policy.mode
      : defaults.mode,
    hostConfidenceThresholds,
    hostSlotConfidenceThresholds: normalizeHostSlotConfidenceThresholds(
      policy.hostSlotConfidenceThresholds,
      hostConfidenceThresholds
    ),
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

function defaultHostSlotConfidenceThresholds(
  hostConfidenceThresholds: Record<ProjectPolicyHost, number>
): Record<ProjectPolicyHost, Record<SlotName, number>> {
  return {
    cli: defaultSlotThresholdsForHost(hostConfidenceThresholds.cli),
    claude: defaultSlotThresholdsForHost(hostConfidenceThresholds.claude),
    codex: defaultSlotThresholdsForHost(hostConfidenceThresholds.codex),
    opencode: defaultSlotThresholdsForHost(hostConfidenceThresholds.opencode)
  };
}

function defaultSlotThresholdsForHost(threshold: number): Record<SlotName, number> {
  return {
    target: threshold,
    success_criteria: threshold,
    constraints: threshold,
    verification: threshold,
    output_format: threshold
  };
}

function normalizeHostSlotConfidenceThresholds(
  thresholds: Partial<Record<ProjectPolicyHost, Partial<Record<SlotName, number>>>> | undefined,
  hostConfidenceThresholds: Record<ProjectPolicyHost, number>
): Record<ProjectPolicyHost, Record<SlotName, number>> {
  return {
    cli: normalizeSlotThresholdsForHost(thresholds?.cli, hostConfidenceThresholds.cli),
    claude: normalizeSlotThresholdsForHost(thresholds?.claude, hostConfidenceThresholds.claude),
    codex: normalizeSlotThresholdsForHost(thresholds?.codex, hostConfidenceThresholds.codex),
    opencode: normalizeSlotThresholdsForHost(thresholds?.opencode, hostConfidenceThresholds.opencode)
  };
}

function normalizeSlotThresholdsForHost(
  thresholds: Partial<Record<SlotName, number>> | undefined,
  hostThreshold: number
): Record<SlotName, number> {
  const defaults = defaultSlotThresholdsForHost(hostThreshold);
  return {
    target: normalizeThreshold(thresholds?.target, defaults.target),
    success_criteria: normalizeThreshold(thresholds?.success_criteria, defaults.success_criteria),
    constraints: normalizeThreshold(thresholds?.constraints, defaults.constraints),
    verification: normalizeThreshold(thresholds?.verification, defaults.verification),
    output_format: normalizeThreshold(thresholds?.output_format, defaults.output_format)
  };
}

function mergeHostSlotConfidenceThresholds(
  current: Record<ProjectPolicyHost, Record<SlotName, number>>,
  incoming: Partial<Record<ProjectPolicyHost, Partial<Record<SlotName, number>>>> | undefined
): Record<ProjectPolicyHost, Record<SlotName, number>> {
  if (!incoming) {
    return current;
  }

  return {
    cli: mergeSlotThresholds(current.cli, incoming.cli),
    claude: mergeSlotThresholds(current.claude, incoming.claude),
    codex: mergeSlotThresholds(current.codex, incoming.codex),
    opencode: mergeSlotThresholds(current.opencode, incoming.opencode)
  };
}

function applyHostThresholdDefaults(
  current: Record<ProjectPolicyHost, Record<SlotName, number>>,
  nextHostConfidenceThresholds: Record<ProjectPolicyHost, number>,
  incomingHostThresholds: Partial<Record<ProjectPolicyHost, number>> | undefined
): Record<ProjectPolicyHost, Record<SlotName, number>> {
  if (!incomingHostThresholds) {
    return current;
  }

  return {
    cli: typeof incomingHostThresholds.cli === "number"
      ? defaultSlotThresholdsForHost(nextHostConfidenceThresholds.cli)
      : current.cli,
    claude: typeof incomingHostThresholds.claude === "number"
      ? defaultSlotThresholdsForHost(nextHostConfidenceThresholds.claude)
      : current.claude,
    codex: typeof incomingHostThresholds.codex === "number"
      ? defaultSlotThresholdsForHost(nextHostConfidenceThresholds.codex)
      : current.codex,
    opencode: typeof incomingHostThresholds.opencode === "number"
      ? defaultSlotThresholdsForHost(nextHostConfidenceThresholds.opencode)
      : current.opencode
  };
}

function mergeSlotThresholds(
  current: Record<SlotName, number>,
  incoming: Partial<Record<SlotName, number>> | undefined
): Record<SlotName, number> {
  if (!incoming) {
    return current;
  }

  const merged = { ...current };
  for (const slot of SLOT_NAMES) {
    if (typeof incoming[slot] === "number") {
      merged[slot] = incoming[slot] as number;
    }
  }
  return merged;
}

function normalizeThreshold(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback;
}
