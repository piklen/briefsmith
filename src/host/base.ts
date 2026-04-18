export type HostAdapterName = "claude" | "codex" | "opencode";
export type InstallScope = "project" | "global";

export interface HostInstallOptions {
  projectRoot: string;
  homeDir: string;
  runtimeRoot?: string;
  scope: InstallScope;
}

export interface HostInstallResult {
  adapter: HostAdapterName;
  scope: InstallScope;
  writtenFiles: string[];
  notes: string[];
}

export interface HostDoctorResult {
  adapter: HostAdapterName;
  scope: InstallScope;
  status: "ok" | "warn" | "fail";
  checks: Array<{
    name: string;
    status: "ok" | "warn" | "fail";
    detail: string;
  }>;
}
