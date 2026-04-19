import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CliContext, SlotName, SlotResolutionSource } from "../../core/types.js";
import { CLI_NAME } from "../command-name.js";
import { runPreflightCommand } from "./preflight.js";

type DemoHost = "cli" | "claude" | "codex" | "opencode";
type DemoAction = "ask" | "compile" | "skip";

interface DemoPayload {
  action: DemoAction;
  host: DemoHost;
  framework: string;
  rawInput: string;
  questions: string[];
  resolvedSlots: Partial<Record<SlotName, string>>;
  compiledPrompt: string;
  evidence: {
    initialMissingSlots: SlotName[];
    unresolvedSlots: SlotName[];
    lowConfidenceSlots: SlotName[];
    resolvedSlotSources: Partial<Record<SlotName, SlotResolutionSource>>;
  };
}

interface DemoScenario {
  title: string;
  host: DemoHost;
  rawInput: string;
  description: string;
  policy?: {
    enabled: boolean;
    mode: "off" | "suggest" | "auto-compile";
  };
}

export async function runDemoCommand(args: string[], context: CliContext): Promise<number> {
  if (args[0] !== "preflight") {
    context.stderr(`usage: ${CLI_NAME} demo preflight [--host cli|claude|codex|opencode]`);
    return 1;
  }

  const host = parseHost(args) ?? "codex";
  const scenarios = buildScenarios(host);

  context.stdout("Briefsmith 30-second demo");
  context.stdout("Runs the real preflight engine with isolated temp state.");
  context.stdout("");

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const payload = await runScenario(scenario);
    context.stdout(`Scenario ${index + 1} — ${scenario.title}`);
    context.stdout(`Host: ${scenario.host}`);
    context.stdout(`Request: ${scenario.rawInput}`);
    context.stdout(`What this shows: ${scenario.description}`);
    context.stdout(`Action: ${payload.action}`);

    if (payload.questions.length > 0) {
      context.stdout(`Questions: ${payload.questions.join(" | ")}`);
    }

    if (Object.keys(payload.resolvedSlots).length > 0) {
      context.stdout(
        `Resolved: ${Object.entries(payload.resolvedSlots)
          .map(([slot, value]) => `${slot}=${value}`)
          .join(" | ")}`
      );
    }

    if (payload.compiledPrompt) {
      context.stdout("Compiled Brief:");
      context.stdout(payload.compiledPrompt);
    }

    context.stdout(
      `Why: initial_missing=${payload.evidence.initialMissingSlots.join(", ") || "none"}; unresolved=${payload.evidence.unresolvedSlots.join(", ") || "none"}; low_confidence=${payload.evidence.lowConfidenceSlots.join(", ") || "none"}`
    );
    context.stdout("");
  }

  context.stdout(`Next step: run \`${CLI_NAME} preflight "<your request>" --host ${host} --json\` on a real request.`);
  return 0;
}

async function runScenario(scenario: DemoScenario): Promise<DemoPayload> {
  const root = mkdtempSync(join(tmpdir(), "briefsmith-demo-"));
  const cwd = join(root, "project");
  const homeDir = join(root, "home");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(homeDir, { recursive: true });

  if (scenario.policy) {
    const configDir = join(cwd, ".prompt-skill");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      `${JSON.stringify({
        ...scenario.policy,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }, null, 2)}\n`
    );
  }

  const output: string[] = [];

  try {
    const exitCode = await runPreflightCommand([scenario.rawInput, "--host", scenario.host, "--json"], {
      cwd,
      homeDir,
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    });

    if (exitCode !== 0) {
      throw new Error(output.join("\n") || "demo preflight failed");
    }

    return JSON.parse(output.join("\n")) as DemoPayload;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function buildScenarios(host: DemoHost): DemoScenario[] {
  return [
    {
      title: "Ask",
      host,
      rawInput: "fix this checkout flow",
      description: "A host-native bugfix request gets blocked because the visible problem signal is still missing."
    },
    {
      title: "Compile",
      host,
      rawInput: "optimize this import flow, success means duplicate parsing happens only once, keep the external API unchanged, and verify with the relevant tests",
      description: "A clear request compiles immediately because target, goal, constraint, and verification are already explicit."
    },
    {
      title: "Skip",
      host,
      rawInput: "optimize this import flow",
      description: "Project policy can explicitly disable preflight when a repo does not want prompt checks.",
      policy: {
        enabled: false,
        mode: "off"
      }
    }
  ];
}

function parseHost(args: string[]): DemoHost | null {
  const hostFlagIndex = args.indexOf("--host");
  if (hostFlagIndex < 0) {
    return null;
  }

  const value = args[hostFlagIndex + 1];
  return value === "cli" || value === "claude" || value === "codex" || value === "opencode"
    ? value
    : null;
}
