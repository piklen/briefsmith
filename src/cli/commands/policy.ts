import type { SlotName } from "../../core/types.js";
import type { CliContext } from "../../core/types.js";
import type { ProjectPolicyHost } from "../../config/project-policy.js";
import { readProjectPolicy, writeProjectPolicy } from "../../config/project-policy.js";
import { CLI_NAME } from "../command-name.js";

export async function stopPromptChecks(cwd: string): Promise<void> {
  await writeProjectPolicy(cwd, { enabled: false, mode: "off" });
}

export async function startPromptChecks(cwd: string): Promise<void> {
  await writeProjectPolicy(cwd, { enabled: true, mode: "suggest" });
}

export async function runPolicyCommand(command: "start" | "stop", context: CliContext): Promise<number> {
  if (command === "start") {
    await startPromptChecks(context.cwd);
    context.stdout("prompt checks enabled for this project");
    return 0;
  }

  await stopPromptChecks(context.cwd);
  context.stdout("prompt checks disabled for this project");
  return 0;
}

export async function runPolicySubcommand(args: string[], context: CliContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "show") {
    const policy = await readProjectPolicy(context.cwd);
    context.stdout(JSON.stringify(policy, null, 2));
    return 0;
  }

  if (subcommand === "mode") {
    const mode = parseMode(rest[0]);
    if (!mode) {
      context.stderr(`usage: ${CLI_NAME} policy mode <off|suggest|auto-compile>`);
      return 1;
    }

    const next = await writeProjectPolicy(context.cwd, {
      enabled: mode !== "off",
      mode
    });
    context.stdout(`${CLI_NAME} policy mode set to ${next.mode}`);
    return 0;
  }

  if (subcommand === "threshold") {
    const host = parseHost(rest[0]);
    if (!host) {
      context.stderr(`usage: ${CLI_NAME} policy threshold <cli|claude|codex|opencode> <value> OR ${CLI_NAME} policy threshold <host> <slot> <value>`);
      return 1;
    }

    if (rest.length === 2) {
      const threshold = parseThreshold(rest[1]);
      if (threshold === null) {
        context.stderr("threshold must be a number between 0 and 1");
        return 1;
      }

      const current = await readProjectPolicy(context.cwd);
      const next = await writeProjectPolicy(context.cwd, {
        enabled: current.enabled,
        mode: current.mode,
        hostConfidenceThresholds: {
          [host]: threshold
        }
      });
      context.stdout(`${CLI_NAME} policy threshold set: ${host}=${next.hostConfidenceThresholds[host]}`);
      return 0;
    }

    if (rest.length === 3) {
      const slot = parseSlot(rest[1]);
      const threshold = parseThreshold(rest[2]);
      if (!slot) {
        context.stderr("slot must be one of target|success_criteria|constraints|verification|output_format");
        return 1;
      }
      if (threshold === null) {
        context.stderr("threshold must be a number between 0 and 1");
        return 1;
      }

      const current = await readProjectPolicy(context.cwd);
      const next = await writeProjectPolicy(context.cwd, {
        enabled: current.enabled,
        mode: current.mode,
        hostSlotConfidenceThresholds: {
          [host]: {
            [slot]: threshold
          }
        }
      });
      context.stdout(`${CLI_NAME} policy slot threshold set: ${host}.${slot}=${next.hostSlotConfidenceThresholds[host][slot]}`);
      return 0;
    }

    context.stderr(`usage: ${CLI_NAME} policy threshold <cli|claude|codex|opencode> <value> OR ${CLI_NAME} policy threshold <host> <slot> <value>`);
    return 1;
  }

  context.stderr(`usage: ${CLI_NAME} policy <show|mode|threshold> ...`);
  return 1;
}

function parseMode(value: string | undefined): "off" | "suggest" | "auto-compile" | null {
  return value === "off" || value === "suggest" || value === "auto-compile"
    ? value
    : null;
}

function parseHost(value: string | undefined): ProjectPolicyHost | null {
  return value === "cli" || value === "claude" || value === "codex" || value === "opencode"
    ? value
    : null;
}

function parseSlot(value: string | undefined): SlotName | null {
  return value === "target" || value === "success_criteria" || value === "constraints" || value === "verification" || value === "output_format"
    ? value
    : null;
}

function parseThreshold(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}
