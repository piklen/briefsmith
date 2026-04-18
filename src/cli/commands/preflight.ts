import { databasePath, globalDataDir } from "../../config/paths.js";
import { buildFollowUpQuestions } from "../../compiler/clarifier.js";
import { readProjectPolicy } from "../../config/project-policy.js";
import { compileOrClarify } from "../../compiler/compiler.js";
import { retrievePromptEntries } from "../../compiler/history-retriever.js";
import type { CliContext, SlotName, SlotResolutionSource } from "../../core/types.js";
import { renderGsdContext } from "../../frameworks/gsd.js";
import { renderGstackBrief } from "../../frameworks/gstack.js";
import { renderSuperpowersBrief } from "../../frameworks/superpowers.js";
import { Database } from "../../storage/database.js";
import { CompileSessionRepository } from "../../storage/compile-session-repository.js";
import { ProfileRepository } from "../../storage/profile-repository.js";
import { PromptRepository } from "../../storage/prompt-repository.js";

type PreflightHost = "cli" | "claude" | "codex" | "opencode";
type Framework = "plain" | "gsd" | "superpowers" | "gstack";
type PreflightAction = "ask" | "compile" | "skip";
const SLOT_ORDER: SlotName[] = ["target", "success_criteria", "constraints", "output_format"];

interface PreflightPayload {
  action: PreflightAction;
  host: PreflightHost;
  framework: Framework;
  rawInput: string;
  questions: string[];
  resolvedSlots: Partial<Record<SlotName, string>>;
  compiledPrompt: string;
  usedHistoryIds: string[];
  evidence: {
    policyMode: "off" | "suggest" | "auto-compile";
    initialMissingSlots: SlotName[];
    unresolvedSlots: SlotName[];
    lowConfidenceSlots: SlotName[];
    confidenceThreshold: number;
    slotConfidenceThresholds: Record<SlotName, number>;
    confidenceGateApplied: boolean;
    resolvedSlotSources: Partial<Record<SlotName, SlotResolutionSource>>;
    resolvedSlotConfidence: Partial<Record<SlotName, number>>;
    historyMatchCount: number;
    historyMatches: Array<{
      id: string;
      tool: string;
      preview: string;
    }>;
  };
}

export async function runPreflightCommand(args: string[], context: CliContext): Promise<number> {
  const options = parsePreflightArgs(args);
  if (!options.rawInput) {
    context.stderr('usage: prompt preflight "<raw input>" [--host cli|claude|codex|opencode] [--json]');
    return 1;
  }

  const policy = await readProjectPolicy(context.cwd);
  const confidenceThreshold = policy.hostConfidenceThresholds[options.host];
  const slotConfidenceThresholds = policy.hostSlotConfidenceThresholds[options.host];
  const confidenceGateApplied = policy.mode !== "auto-compile";
  if (!policy.enabled) {
    return outputPayload(
      {
        action: "skip",
        host: options.host,
        framework: options.framework,
        rawInput: options.rawInput,
        questions: [],
        resolvedSlots: {},
        compiledPrompt: "",
        usedHistoryIds: [],
        evidence: {
          policyMode: policy.mode,
          initialMissingSlots: [],
          unresolvedSlots: [],
          lowConfidenceSlots: [],
          confidenceThreshold,
          slotConfidenceThresholds,
          confidenceGateApplied,
          resolvedSlotSources: {},
          resolvedSlotConfidence: {},
          historyMatchCount: 0,
          historyMatches: []
        }
      },
      options.json,
      context
    );
  }

  const database = new Database(databasePath(globalDataDir(context.homeDir)));
  const promptRepository = new PromptRepository(database);
  const profileRepository = new ProfileRepository(database);
  const compileSessionRepository = new CompileSessionRepository(database);

  try {
    const profile = profileRepository.load("global");
    const historyMatches = retrievePromptEntries(promptRepository, options.rawInput, 3);
    const snippets = historyMatches.map((row) => row.promptText);
    const historyEvidence = historyMatches.map((entry) => ({
      id: entry.id,
      tool: entry.tool,
      preview: buildPromptPreview(entry.promptText)
    }));
    const decision = compileOrClarify(options.rawInput, profile.inferred, snippets);
    const usedHistoryIds = historyMatches.map((row) => row.id);
    const lowConfidenceSlots = findLowConfidenceSlots(
      decision.resolvedSlotConfidence,
      slotConfidenceThresholds
    );
    const askSlots = mergeAskSlots(
      decision.missing,
      confidenceGateApplied ? lowConfidenceSlots : []
    );
    const questions = buildFollowUpQuestions(askSlots);

    if (askSlots.length > 0) {
      compileSessionRepository.save({
        rawInput: options.rawInput,
        compiledPrompt: "",
        followUpQuestions: questions,
        resolvedSlots: decision.resolvedSlots,
        targetFramework: options.framework,
        targetHost: options.host,
        usedHistoryIds
      });

      return outputPayload(
        {
          action: "ask",
          host: options.host,
          framework: options.framework,
          rawInput: options.rawInput,
          questions,
          resolvedSlots: decision.resolvedSlots,
          compiledPrompt: "",
          usedHistoryIds,
          evidence: {
            policyMode: policy.mode,
            initialMissingSlots: decision.initialMissing,
            unresolvedSlots: decision.missing,
            lowConfidenceSlots,
            confidenceThreshold,
            slotConfidenceThresholds,
            confidenceGateApplied,
            resolvedSlotSources: decision.resolvedSlotSources,
            resolvedSlotConfidence: decision.resolvedSlotConfidence,
            historyMatchCount: historyMatches.length,
            historyMatches: historyEvidence
          }
        },
        options.json,
        context
      );
    }

    const compiledPrompt = renderForFramework(
      options.framework,
      options.rawInput,
      decision.text,
      snippets
    );

    compileSessionRepository.save({
      rawInput: options.rawInput,
      compiledPrompt,
      followUpQuestions: [],
      resolvedSlots: decision.resolvedSlots,
      targetFramework: options.framework,
      targetHost: options.host,
      usedHistoryIds
    });

    return outputPayload(
      {
        action: "compile",
        host: options.host,
        framework: options.framework,
        rawInput: options.rawInput,
        questions: [],
        resolvedSlots: decision.resolvedSlots,
        compiledPrompt,
        usedHistoryIds,
        evidence: {
          policyMode: policy.mode,
          initialMissingSlots: decision.initialMissing,
          unresolvedSlots: [],
          lowConfidenceSlots,
          confidenceThreshold,
          slotConfidenceThresholds,
          confidenceGateApplied,
          resolvedSlotSources: decision.resolvedSlotSources,
          resolvedSlotConfidence: decision.resolvedSlotConfidence,
          historyMatchCount: historyMatches.length,
          historyMatches: historyEvidence
        }
      },
      options.json,
      context
    );
  } finally {
    database.close();
  }
}

function outputPayload(payload: PreflightPayload, json: boolean, context: CliContext): number {
  if (json) {
    context.stdout(JSON.stringify(payload));
    return 0;
  }

  if (payload.action === "skip") {
    context.stdout("prompt checks disabled for this project");
    return 0;
  }

  if (payload.action === "ask") {
    context.stdout(`Prompt Skill needs more context:\n- ${payload.questions.join("\n- ")}`);
    context.stdout(renderEvidenceLines(payload.evidence));
    return 0;
  }

  context.stdout(`Prompt Skill Context\n${payload.compiledPrompt}`);
  context.stdout(renderEvidenceLines(payload.evidence));
  return 0;
}

function renderEvidenceLines(evidence: PreflightPayload["evidence"]): string {
  const slotSources = Object.entries(evidence.resolvedSlotSources)
    .map(([slot, source]) => `${slot}=${source}`)
    .join(", ");
  const slotConfidence = Object.entries(evidence.resolvedSlotConfidence)
    .map(([slot, value]) => `${slot}=${value.toFixed(2)}`)
    .join(", ");

  return [
    "Prompt Skill Evidence",
    `- policy_mode: ${evidence.policyMode}`,
    `- initial_missing: ${evidence.initialMissingSlots.join(", ") || "none"}`,
    `- unresolved: ${evidence.unresolvedSlots.join(", ") || "none"}`,
    `- low_confidence: ${evidence.lowConfidenceSlots.join(", ") || "none"}`,
    `- confidence_threshold: ${String(evidence.confidenceThreshold)}`,
    `- slot_thresholds: ${renderSlotThresholds(evidence.slotConfidenceThresholds)}`,
    `- confidence_gate_applied: ${String(evidence.confidenceGateApplied)}`,
    `- history_matches: ${String(evidence.historyMatchCount)}`,
    `- history_preview: ${renderHistoryPreviews(evidence.historyMatches)}`,
    `- slot_sources: ${slotSources || "none"}`,
    `- slot_confidence: ${slotConfidence || "none"}`
  ].join("\n");
}

function renderHistoryPreviews(matches: PreflightPayload["evidence"]["historyMatches"]): string {
  if (matches.length === 0) {
    return "none";
  }

  return matches.map((match) => `${match.id} (${match.tool}): ${match.preview}`).join(" | ");
}

function buildPromptPreview(text: string, maxLength = 72): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function mergeAskSlots(unresolved: SlotName[], lowConfidence: SlotName[]): SlotName[] {
  const merged = new Set<SlotName>([...unresolved, ...lowConfidence]);
  return SLOT_ORDER.filter((slot) => merged.has(slot));
}

function findLowConfidenceSlots(
  resolvedSlotConfidence: Partial<Record<SlotName, number>>,
  slotThresholds: Record<SlotName, number>
): SlotName[] {
  return SLOT_ORDER.filter((slot) => {
    const value = resolvedSlotConfidence[slot];
    const threshold = slotThresholds[slot];
    return typeof value === "number" && value < threshold;
  });
}

function renderSlotThresholds(slotThresholds: Record<SlotName, number>): string {
  return SLOT_ORDER.map((slot) => `${slot}=${slotThresholds[slot].toFixed(2)}`).join(", ");
}


function renderForFramework(
  framework: Framework,
  rawInput: string,
  compiledPrompt: string,
  historySnippets: string[]
): string {
  if (framework === "gsd") {
    return renderGsdContext({ rawInput, compiledPrompt, historySnippets });
  }

  if (framework === "superpowers") {
    return renderSuperpowersBrief({ rawInput, compiledPrompt, historySnippets });
  }

  if (framework === "gstack") {
    return renderGstackBrief({ rawInput, compiledPrompt, historySnippets });
  }

  return compiledPrompt;
}

function parsePreflightArgs(args: string[]): {
  rawInput: string;
  host: PreflightHost;
  framework: Framework;
  json: boolean;
} {
  const inputParts: string[] = [];
  let host: PreflightHost = "cli";
  let framework: Framework = "plain";
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--host") {
      const candidate = args[index + 1];
      host = parseHost(candidate) ?? host;
      index += 1;
      continue;
    }

    if (value === "--framework") {
      const candidate = args[index + 1];
      framework = parseFramework(candidate) ?? framework;
      index += 1;
      continue;
    }

    inputParts.push(value);
  }

  return {
    rawInput: inputParts.join(" ").trim(),
    host,
    framework,
    json
  };
}

function parseHost(value: string | undefined): PreflightHost | null {
  return value === "cli" || value === "claude" || value === "codex" || value === "opencode"
    ? value
    : null;
}

function parseFramework(value: string | undefined): Framework | null {
  return value === "plain" || value === "gsd" || value === "superpowers" || value === "gstack"
    ? value
    : null;
}
