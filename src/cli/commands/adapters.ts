import type { CliContext } from "../../core/types.js";
import { doctorClaudeAdapter } from "../../host/claude/doctor.js";
import { installClaudeAdapter } from "../../host/claude/install.js";
import { doctorCodexAdapter } from "../../host/codex/doctor.js";
import { installCodexAdapter } from "../../host/codex/install.js";
import type { HostAdapterName, InstallScope } from "../../host/base.js";

const SUPPORTED_ADAPTERS: Array<{ name: HostAdapterName; scopes: InstallScope[] }> = [
  { name: "claude", scopes: ["project", "global"] },
  { name: "codex", scopes: ["project", "global"] }
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
      if (!name || !isAdapterName(name)) {
        context.stderr("usage: prompt adapters install <claude|codex> [--scope project|global]");
        return 1;
      }
      const scope = parseScope(rest) ?? "project";
      const result = name === "claude"
        ? await installClaudeAdapter({
            projectRoot: context.cwd,
            runtimeRoot: context.cwd,
            homeDir: context.homeDir,
            scope
          })
        : await installCodexAdapter({
            projectRoot: context.cwd,
            homeDir: context.homeDir,
            scope
          });

      context.stdout(`installed ${result.adapter} adapter (${result.scope})`);
      for (const file of result.writtenFiles) {
        context.stdout(`- ${file}`);
      }
      for (const note of result.notes) {
        context.stdout(`note: ${note}`);
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
          : await doctorCodexAdapter(context.cwd, context.homeDir, scope);

        context.stdout(`[${result.status}] ${result.adapter} (${result.scope})`);
        for (const check of result.checks) {
          context.stdout(`  [${check.status}] ${check.name}: ${check.detail}`);
        }
      }
      return 0;
    }
    default:
      context.stderr("usage: prompt adapters <list|install|doctor> ...");
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
  return value === "claude" || value === "codex";
}
