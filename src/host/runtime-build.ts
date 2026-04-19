import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathExists } from "../utils/filesystem.js";

const execFileAsync = promisify(execFile);
const REQUIRED_RUNTIME_ARTIFACTS = [
  ["dist", "src", "cli", "index.js"],
  ["dist", "src", "host", "claude", "hook-entry.js"]
] as const;

export type RuntimeBuildRunner = (runtimeRoot: string) => Promise<void>;

export async function ensureRuntimeBuild(
  runtimeRoot: string,
  runBuild: RuntimeBuildRunner = runNpmBuild
): Promise<boolean> {
  const before = await findMissingArtifacts(runtimeRoot);
  if (before.length === 0) {
    return false;
  }

  const packageJsonPath = join(runtimeRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`runtime build required but package.json not found: ${packageJsonPath}`);
  }

  await runBuild(runtimeRoot);

  const after = await findMissingArtifacts(runtimeRoot);
  if (after.length > 0) {
    throw new Error(`runtime build completed but required artifacts are still missing: ${after.join(", ")}`);
  }

  return true;
}

async function findMissingArtifacts(runtimeRoot: string): Promise<string[]> {
  const missing: string[] = [];
  for (const parts of REQUIRED_RUNTIME_ARTIFACTS) {
    const filePath = join(runtimeRoot, ...parts);
    if (!(await pathExists(filePath))) {
      missing.push(filePath);
    }
  }

  return missing;
}

async function runNpmBuild(runtimeRoot: string): Promise<void> {
  try {
    await execFileAsync("npm", ["run", "build"], {
      cwd: runtimeRoot,
      env: process.env
    });
  } catch (error) {
    const typedError = error as Error & { stdout?: string; stderr?: string };
    const detail = [typedError.stdout, typedError.stderr].filter(Boolean).join("\n").trim();
    throw new Error(detail.length > 0 ? `npm run build failed:\n${detail}` : "npm run build failed");
  }
}
