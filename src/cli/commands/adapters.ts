import type { CliContext } from "../../core/types.js";
import { doctorClaudeAdapter } from "../../host/claude/doctor.js";
import { installClaudeAdapter } from "../../host/claude/install.js";
import { doctorCodexAdapter } from "../../host/codex/doctor.js";
import { installCodexAdapter } from "../../host/codex/install.js";
import { doctorOpenCodeAdapter } from "../../host/opencode/doctor.js";
import { installOpenCodeAdapter } from "../../host/opencode/install.js";
import { ensureRuntimeBuild } from "../../host/runtime-build.js";
import type { HostAdapterName, InstallScope } from "../../host/base.js";
import { CLI_NAME } from "../command-name.js";

const SUPPORTED_ADAPTERS: Array<{ name: HostAdapterName; scopes: InstallScope[] }> = [
  { name: "claude", scopes: ["project", "global"] },
  { name: "codex", scopes: ["project", "global"] },
  { name: "opencode", scopes: ["project", "global"] }
];

export async function runAdaptersCommand(args: string[], context: CliContext): Promise<number> {
  const [subcommand, name, ...rest] = args;

  switch (subcommand) {
    case "list":
      for (const adapter of SUPPORTED_ADAPTERS) {
        context.stdout(`${adapter.name}: ${adapter.scopes.join(", ")}`);
      }
      return 0;
    case "install": {
      if (!name || !isInstallTarget(name)) {
        context.stderr(`usage: ${CLI_NAME} adapters install <claude|codex|opencode|all> [--scope project|global]`);
        return 1;
      }
      const scope = parseScope(rest) ?? "project";
      const built = await ensureRuntimeBuild(context.cwd);
      if (built) {
        context.stdout("built runtime artifacts with npm run build");
      }

      const targets = name === "all" ? SUPPORTED_ADAPTERS.map((adapter) => adapter.name) : [name];
      for (const target of targets) {
        const result = await installAdapter(target, scope, context);
        context.stdout(`installed ${result.adapter} adapter (${result.scope})`);
        for (const file of result.writtenFiles) {
          context.stdout(`- ${file}`);
        }
        for (const note of result.notes) {
          context.stdout(`note: ${note}`);
        }
      }
      return 0;
    }
    case "doctor": {
      const doctorArgs = name && isAdapterName(name) ? rest : [name, ...rest].filter((value): value is string => Boolean(value));
      const scope = parseScope(doctorArgs) ?? "project";
      const targets = name && isAdapterName(name) ? [name] : SUPPORTED_ADAPTERS.map((adapter) => adapter.name);
      for (const target of targets) {
        const result = target === "claude"
          ? await doctorClaudeAdapter(context.cwd, context.homeDir, scope)
          : target === "codex"
            ? await doctorCodexAdapter(context.cwd, context.homeDir, scope)
            : await doctorOpenCodeAdapter(context.cwd, context.homeDir, scope);

        context.stdout(`[${result.status}] ${result.adapter} (${result.scope})`);
        for (const check of result.checks) {
          context.stdout(`  [${check.status}] ${check.name}: ${check.detail}`);
        }
      }
      return 0;
    }
    default:
      context.stderr(`usage: ${CLI_NAME} adapters <list|install|doctor> ...`);
      return 1;
  }
}

function parseScope(args: string[]): InstallScope | null {
  const index = args.indexOf("--scope");
  if (index === -1) {
    return null;
  }

  const scope = args[index + 1];
  return scope === "global" || scope === "project" ? scope : null;
}

function isAdapterName(value: string): value is HostAdapterName {
  return value === "claude" || value === "codex" || value === "opencode";
}

function isInstallTarget(value: string): value is HostAdapterName | "all" {
  return value === "all" || isAdapterName(value);
}

async function installAdapter(
  name: HostAdapterName,
  scope: InstallScope,
  context: CliContext
) {
  if (name === "claude") {
    return installClaudeAdapter({
      projectRoot: context.cwd,
      runtimeRoot: context.cwd,
      homeDir: context.homeDir,
      scope
    });
  }

  if (name === "codex") {
    return installCodexAdapter({
      projectRoot: context.cwd,
      homeDir: context.homeDir,
      scope
    });
  }

  return installOpenCodeAdapter({
    projectRoot: context.cwd,
    homeDir: context.homeDir,
    scope
  });
}
