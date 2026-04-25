import type {
  CompileDecision,
  CompilePromptInput,
  RetrievedPromptSnippet,
  SlotName,
  SlotResolutionSource
} from "../core/types.js";
import { buildFollowUpQuestions } from "./clarifier.js";
import { prefersChinese } from "./language.js";
import { detectMissingSlots } from "./slot-detector.js";

const SLOT_RENDER_ORDER: SlotName[] = ["target", "problem_signal", "success_criteria", "constraints", "verification", "output_format"];
const EXPLICIT_SUCCESS_PATTERNS = [
  /((?:success(?:\s+means|\s+is|\s+looks like)?)[^,.;!?\n]{0,96})/i,
  /(so that[^,.;!?\n]{0,96})/i,
  /((?:成功标准|目标|结果)[是为][^，。；,.!?\n]{0,64})/i
] as const;
const EXPLICIT_VERIFICATION_PATTERNS = [
  /((?:verify|verified|validation|validate|tests?|benchmark|benchmarks|regression checks?|smoke checks?)[^,.;!?\n]{0,96})/i,
  /((?:测试|验证|回归|基准|压测|复现|复测)[^，。；,.!?\n]{0,64})/i
] as const;
const SUCCESS_HINTS = [
  {
    pattern: /optimi[sz]e|performance|优化/i,
    zh: "提升可读性、减少重复，并让实现更稳定。",
    en: "Improve readability, reduce duplication, and make the implementation more stable."
  },
  {
    pattern: /fix|bug|broken|修复|报错/i,
    zh: "恢复正确行为，并定位导致问题的直接原因。",
    en: "Restore correct behavior and identify the direct cause of the issue."
  },
  {
    pattern: /review|audit|检查|审查/i,
    zh: "找出具体问题、风险点和缺失的验证。",
    en: "Identify concrete issues, risks, and missing verification."
  },
  {
    pattern: /build|create|implement|实现|构建/i,
    zh: "交付可运行实现，并保证接入方式清晰。",
    en: "Deliver a working implementation with a clear integration path."
  },
  {
    pattern: /explain|why|原因|解释/i,
    zh: "解释根因、机制和关键边界条件。",
    en: "Explain the root cause, mechanism, and key boundary conditions."
  },
  {
    pattern: /plan|设计|方案|规划/i,
    zh: "给出可执行方案，并说明风险与回滚方式。",
    en: "Provide an actionable plan with risks and rollback considerations."
  }
] as const;
const PROBLEM_SIGNAL_PATTERNS = [
  /((?:报错|异常|超时|崩溃|卡住|失败|回归|告警|无响应|不生效)[^，。；,.!?\n]{0,48})/i,
  /((?:error|exception|timeout|timed out|crash|stuck|failing|failed|regression|slow|slower|latency|500|404)[^,.;!?\n]{0,64})/i,
  /((?:why\s+is|why\s+does|无法|不能)[^，。；,.!?\n]{0,48})/i
] as const;
const VERIFICATION_HINTS = [
  {
    pattern: /optimi[sz]e|performance|refactor|improve|simplify|优化|性能|重构|改进|简化/i,
    zh: "运行相关测试或关键流程回归，验证优化前后的行为或性能变化符合预期。",
    en: "Run the relevant tests or smoke checks on the affected flow, and compare before/after behavior or performance."
  },
  {
    pattern: /fix|bug|broken|repair|修复|报错|故障/i,
    zh: "先复现问题，再运行相关测试或回归检查，确认问题消失且没有引入新回归。",
    en: "Reproduce the issue first, then run the relevant tests or regression checks to confirm the bug is fixed without introducing regressions."
  },
  {
    pattern: /build|create|implement|add|构建|实现|新增/i,
    zh: "运行新增或受影响的测试，并手动验证接入路径或关键用户流程可用。",
    en: "Run the new or affected tests, and manually verify the integration path or key user flow."
  },
  {
    pattern: /migrate|upgrade|升级|迁移/i,
    zh: "执行迁移后的回归检查，并确认兼容性或数据状态符合预期。",
    en: "Run post-migration regression checks and confirm compatibility or data state matches the expected outcome."
  }
] as const;
const EXPLICIT_CONSTRAINT_PATTERN = /(保持[^，。；,.!?\n]{0,40}(?:不变|不修改|不动|兼容)|不要[^，。；,.!?\n]{0,40}|不能[^，。；,.!?\n]{0,40}|do not[^,.;!?\n]{0,60}|don't[^,.;!?\n]{0,60}|without[^,.;!?\n]{0,60}|keep[^,.;!?\n]{0,60}|preserve[^,.;!?\n]{0,60})/i;
const CHINESE_TARGET_PATTERNS = [
  /(?:这个|该|此|那个)([\u4e00-\u9fffA-Za-z0-9_-]{2,24})/i,
  /([\u4e00-\u9fffA-Za-z0-9_-]{2,24}(?:导入逻辑|导入器|查询|接口|模块|函数|脚本|命令|流程|适配器|配置|组件|页面|服务|数据库|测试|文档|提示词))/i,
  /([\u4e00-\u9fffA-Za-z0-9_-]{2,24}(?:逻辑|行为|结构|策略|实现|解析))/i
] as const;
const ENGLISH_TARGET_PATTERNS = [
  /\b(?:this|that|the)\s+([a-z][a-z0-9_-]*(?:\s+[a-z][a-z0-9_-]*){0,3})\b/i,
  /\b([a-z][a-z0-9_-]*(?:\s+[a-z][a-z0-9_-]*){0,2}\s+(?:query|importer|import logic|module|function|script|api|hook|workflow|adapter|component|page|service|database|test|docs?))\b/i
] as const;
const GENERIC_TARGETS = new Set([
  "this",
  "that",
  "it",
  "logic",
  "code",
  "thing",
  "stuff",
  "部分",
  "内容",
  "地方",
  "代码",
  "功能",
  "模块",
  "脚本",
  "文件",
  "逻辑",
  "问题",
  "东西"
]);
const INPUT_CONFIDENCE = 0.96;
const HISTORY_CONFIDENCE = 0.82;
const HISTORY_PROBLEM_SIGNAL_CONFIDENCE = 0.76;
const SESSION_CONFIDENCE = 0.9;
const HEURISTIC_CONFIDENCE = 0.68;
const VERIFICATION_CONFIDENCE = 0.78;
const DEFAULT_CONFIDENCE = 0.55;

interface SlotResolutionCandidate {
  value: string;
  source: SlotResolutionSource;
  confidence: number;
  historySnippet?: RetrievedPromptSnippet;
}

export function compilePrompt(input: CompilePromptInput): string {
  const defaults = renderContextEntries(input.inferredDefaults);
  const answers = renderSlotEntries(
    input.followUpAnswers,
    input.resolvedSlotSources ?? {},
    input.resolvedSlotConfidence ?? {},
    input.resolvedSlotHistoryIds ?? {}
  );

  const history = input.retrievedPromptSnippets.map((snippet) => `- ${snippet}`).join("\n");

  return [
    "Task Goal",
    input.rawInput,
    "",
    "Resolved Context",
    answers || "- none",
    "",
    "Inferred Defaults",
    defaults || "- none",
    "",
    "Relevant Prompt Memory",
    history || "- none",
    "",
    "Execution Requirements",
    "- keep the final answer aligned to the resolved context",
    "- call out assumptions when context is still incomplete",
    "- preserve risk boundaries from the resolved context",
    "- follow the verification plan from the resolved context, or say explicitly if you could not run it"
  ].join("\n");
}

export function compileOrClarify(
  rawInput: string,
  inferredDefaults: Record<string, unknown>,
  retrievedPromptSnippets: Array<string | RetrievedPromptSnippet>,
  continuationSlots: Partial<Record<SlotName, string>> = {}
): CompileDecision {
  const historySnippets = normalizeHistorySnippets(retrievedPromptSnippets);
  const missingResult = detectMissingSlots(rawInput);
  const explicit = extractExplicitSlotValues(rawInput);
  const resolution = resolveMissingSlots(
    rawInput,
    missingResult.missing,
    inferredDefaults,
    historySnippets,
    continuationSlots
  );
  const resolvedSlots = {
    ...resolution.values,
    ...explicit.values
  };
  const resolvedSlotSources = {
    ...resolution.sources,
    ...explicit.sources
  };
  const resolvedSlotConfidence = {
    ...resolution.confidence,
    ...explicit.confidence
  };
  const resolvedSlotHistoryIds = collectResolvedSlotHistoryIds(resolution.historySnippets);
  const usedHistoryIds = collectUsedHistoryIds(resolution.historySnippets);
  const unresolved = missingResult.missing.filter((slot) => !resolvedSlots[slot]);
  const followUpQuestions = buildFollowUpQuestions({
    rawInput,
    missing: unresolved,
    resolvedSlots,
    inferredDefaults
  });

  if (shouldAskFollowUp(unresolved)) {
    return {
      kind: "questions",
      text: followUpQuestions.join("\n"),
      missing: unresolved,
      initialMissing: missingResult.missing,
      resolvedSlots,
      resolvedSlotSources,
      resolvedSlotHistoryIds,
      resolvedSlotConfidence,
      usedHistoryIds,
      followUpQuestions
    };
  }

  const effectivePromptSnippets = collectUsedHistoryTexts(resolution.historySnippets);
  const compiled = compilePrompt({
    rawInput,
    inferredDefaults,
    followUpAnswers: resolvedSlots,
    resolvedSlotSources,
    resolvedSlotConfidence,
    resolvedSlotHistoryIds,
    retrievedPromptSnippets: effectivePromptSnippets
  });

  return {
    kind: "compiled",
    text: compiled,
    missing: [],
    initialMissing: missingResult.missing,
    resolvedSlots,
    resolvedSlotSources,
    resolvedSlotHistoryIds,
    resolvedSlotConfidence,
    usedHistoryIds,
    followUpQuestions: []
  };
}

function extractExplicitSlotValues(rawInput: string): {
  values: Partial<Record<SlotName, string>>;
  sources: Partial<Record<SlotName, SlotResolutionSource>>;
  confidence: Partial<Record<SlotName, number>>;
} {
  const values: Partial<Record<SlotName, string>> = {};
  const sources: Partial<Record<SlotName, SlotResolutionSource>> = {};
  const confidence: Partial<Record<SlotName, number>> = {};

  const target = inferTarget(rawInput);
  if (target) {
    values.target = target.value;
    sources.target = target.source;
    confidence.target = target.confidence;
  }

  const problemSignal = extractProblemSignal(rawInput);
  if (problemSignal) {
    values.problem_signal = problemSignal;
    sources.problem_signal = "input";
    confidence.problem_signal = INPUT_CONFIDENCE;
  }

  const successCriteria = extractExplicitSuccessCriteria(rawInput);
  if (successCriteria) {
    values.success_criteria = successCriteria;
    sources.success_criteria = "input";
    confidence.success_criteria = INPUT_CONFIDENCE;
  }

  const constraint = extractConstraint(rawInput);
  if (constraint) {
    values.constraints = constraint;
    sources.constraints = "input";
    confidence.constraints = INPUT_CONFIDENCE;
  }

  const verification = extractExplicitVerification(rawInput);
  if (verification) {
    values.verification = verification;
    sources.verification = "input";
    confidence.verification = INPUT_CONFIDENCE;
  }

  return { values, sources, confidence };
}

function resolveMissingSlots(
  rawInput: string,
  missing: SlotName[],
  inferredDefaults: Record<string, unknown>,
  retrievedPromptSnippets: RetrievedPromptSnippet[],
  continuationSlots: Partial<Record<SlotName, string>>
): {
  values: Partial<Record<SlotName, string>>;
  sources: Partial<Record<SlotName, SlotResolutionSource>>;
  confidence: Partial<Record<SlotName, number>>;
  historySnippets: Partial<Record<SlotName, RetrievedPromptSnippet>>;
} {
  const values: Partial<Record<SlotName, string>> = {};
  const sources: Partial<Record<SlotName, SlotResolutionSource>> = {};
  const confidence: Partial<Record<SlotName, number>> = {};
  const historySnippets: Partial<Record<SlotName, RetrievedPromptSnippet>> = {};

  const assignResolvedSlot = (slot: SlotName, candidate: SlotResolutionCandidate): void => {
    values[slot] = candidate.value;
    sources[slot] = candidate.source;
    confidence[slot] = candidate.confidence;
    if (candidate.historySnippet) {
      historySnippets[slot] = candidate.historySnippet;
    }
  };

  for (const slot of missing) {
    const continuationValue = continuationSlots[slot];
    if (continuationValue) {
      assignResolvedSlot(slot, {
        value: continuationValue,
        source: "session",
        confidence: SESSION_CONFIDENCE
      });
      continue;
    }

    if (slot === "target") {
      const target = inferTarget(rawInput);
      if (target) {
        assignResolvedSlot("target", target);
      }
      continue;
    }

    if (slot === "success_criteria") {
      const success = inferSuccessCriteria(rawInput, inferredDefaults);
      if (success) {
        assignResolvedSlot("success_criteria", success);
      }
      continue;
    }

    if (slot === "problem_signal") {
      const problemSignal = inferProblemSignal(rawInput, retrievedPromptSnippets);
      if (problemSignal) {
        assignResolvedSlot("problem_signal", problemSignal);
      }
      continue;
    }

    if (slot === "constraints") {
      const constraint = inferConstraint(rawInput, retrievedPromptSnippets);
      if (constraint) {
        assignResolvedSlot("constraints", constraint);
      }
      continue;
    }

    if (slot === "verification") {
      const verification = inferVerification(rawInput, inferredDefaults);
      if (verification) {
        assignResolvedSlot("verification", verification);
      }
      continue;
    }

    if (slot === "output_format") {
      assignResolvedSlot("output_format", {
        value: prefersChinese(rawInput, inferredDefaults)
          ? "结构化任务说明"
          : "Structured task brief",
        source: "default",
        confidence: DEFAULT_CONFIDENCE
      });
    }
  }

  return { values, sources, confidence, historySnippets };
}

function shouldAskFollowUp(unresolved: SlotName[]): boolean {
  return unresolved.includes("target") || unresolved.includes("problem_signal") || unresolved.length >= 2;
}

function inferTarget(
  rawInput: string
): { value: string; source: SlotResolutionSource; confidence: number } | null {
  for (const pattern of CHINESE_TARGET_PATTERNS) {
    const match = rawInput.match(pattern);
    const candidate = normalizeCandidate(match?.[1]);
    if (candidate && !GENERIC_TARGETS.has(candidate.toLowerCase())) {
      return { value: candidate, source: "input", confidence: INPUT_CONFIDENCE };
    }
  }

  for (const pattern of ENGLISH_TARGET_PATTERNS) {
    const match = rawInput.match(pattern);
    const candidate = normalizeCandidate(match?.[1]);
    if (candidate && !GENERIC_TARGETS.has(candidate.toLowerCase())) {
      return { value: candidate, source: "input", confidence: INPUT_CONFIDENCE };
    }
  }

  return null;
}

function inferSuccessCriteria(
  rawInput: string,
  inferredDefaults: Record<string, unknown>
): { value: string; source: SlotResolutionSource; confidence: number } | null {
  const useChinese = prefersChinese(rawInput, inferredDefaults);

  for (const hint of SUCCESS_HINTS) {
    if (hint.pattern.test(rawInput)) {
      return {
        value: useChinese ? hint.zh : hint.en,
        source: "heuristic",
        confidence: HEURISTIC_CONFIDENCE
      };
    }
  }

  return null;
}

function inferVerification(
  rawInput: string,
  inferredDefaults: Record<string, unknown>
): { value: string; source: SlotResolutionSource; confidence: number } | null {
  const useChinese = prefersChinese(rawInput, inferredDefaults);

  for (const hint of VERIFICATION_HINTS) {
    if (hint.pattern.test(rawInput)) {
      return {
        value: useChinese ? hint.zh : hint.en,
        source: "heuristic",
        confidence: VERIFICATION_CONFIDENCE
      };
    }
  }

  return null;
}

function inferProblemSignal(
  rawInput: string,
  retrievedPromptSnippets: RetrievedPromptSnippet[]
): SlotResolutionCandidate | null {
  const direct = extractProblemSignal(rawInput);
  if (direct) {
    return { value: direct, source: "input", confidence: INPUT_CONFIDENCE };
  }

  for (const snippet of retrievedPromptSnippets) {
    const fromHistory = extractProblemSignal(snippet.text);
    if (fromHistory) {
      return {
        value: fromHistory,
        source: "history",
        confidence: HISTORY_PROBLEM_SIGNAL_CONFIDENCE,
        historySnippet: snippet
      };
    }
  }

  return null;
}

function inferConstraint(
  rawInput: string,
  retrievedPromptSnippets: RetrievedPromptSnippet[]
): SlotResolutionCandidate | null {
  const direct = extractConstraint(rawInput);
  if (direct) {
    return { value: direct, source: "input", confidence: INPUT_CONFIDENCE };
  }

  for (const snippet of retrievedPromptSnippets) {
    const fromHistory = extractConstraintFromHistory(snippet.text);
    if (fromHistory) {
      return {
        value: fromHistory,
        source: "history",
        confidence: HISTORY_CONFIDENCE,
        historySnippet: snippet
      };
    }
  }

  return null;
}

function extractConstraint(text: string): string | null {
  const match = text.match(EXPLICIT_CONSTRAINT_PATTERN);
  const normalized = normalizeCandidate(match?.[1] ?? match?.[0]);
  if (!normalized) {
    return null;
  }

  return normalized.replace("外部命令行为", "外部行为（命令行为）");
}

function extractConstraintFromHistory(text: string): string | null {
  const constraint = extractConstraint(text);
  if (!constraint) {
    return null;
  }

  return isMetaConversationalConstraint(constraint) ? null : constraint;
}

function isMetaConversationalConstraint(text: string): boolean {
  return /(ai|用户|prompt|提示词|skill|宿主|问用户|追问|follow[- ]?up|context|上下文|请求本身)/i.test(text);
}

function extractExplicitSuccessCriteria(text: string): string | null {
  for (const pattern of EXPLICIT_SUCCESS_PATTERNS) {
    const match = text.match(pattern);
    const normalized = normalizeCandidate(match?.[1] ?? match?.[0]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractExplicitVerification(text: string): string | null {
  for (const pattern of EXPLICIT_VERIFICATION_PATTERNS) {
    const match = text.match(pattern);
    const normalized = normalizeCandidate(match?.[1] ?? match?.[0]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractProblemSignal(text: string): string | null {
  for (const pattern of PROBLEM_SIGNAL_PATTERNS) {
    const match = text.match(pattern);
    const normalized = normalizeCandidate(match?.[1] ?? match?.[0]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function renderSlotEntries(
  values: Partial<Record<SlotName, string>>,
  sources: Partial<Record<SlotName, SlotResolutionSource>>,
  confidence: Partial<Record<SlotName, number>>,
  historyIds: Partial<Record<SlotName, string>>
): string {
  const lines = SLOT_RENDER_ORDER
    .flatMap((slot) => {
      const value = values[slot];
      if (!value) {
        return [];
      }

      const label = renderSlotLabel(slot, sources);
      const metadata = renderSlotMetadata(slot, sources, confidence, historyIds);
      return [`- ${label}${metadata}: ${value}`];
    });

  return lines.join("\n");
}

function renderSlotLabel(
  slot: SlotName,
  sources: Partial<Record<SlotName, SlotResolutionSource>>
): string {
  return slot === "success_criteria" && sources[slot] === "heuristic"
    ? "default_success_direction"
    : slot;
}

function renderSlotMetadata(
  slot: SlotName,
  sources: Partial<Record<SlotName, SlotResolutionSource>>,
  confidence: Partial<Record<SlotName, number>>,
  historyIds: Partial<Record<SlotName, string>>
): string {
  const parts: string[] = [];
  const source = sources[slot];
  const confidenceValue = confidence[slot];
  const historyId = historyIds[slot];

  if (source) {
    parts.push(source);
  }

  if (typeof confidenceValue === "number") {
    parts.push(`confidence ${confidenceValue.toFixed(2)}`);
  }

  if (historyId) {
    parts.push(`history ${historyId}`);
  }

  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

function normalizeHistorySnippets(
  retrievedPromptSnippets: Array<string | RetrievedPromptSnippet>
): RetrievedPromptSnippet[] {
  return retrievedPromptSnippets.map((snippet) =>
    typeof snippet === "string" ? { text: snippet } : snippet
  );
}

function collectResolvedSlotHistoryIds(
  historySnippets: Partial<Record<SlotName, RetrievedPromptSnippet>>
): Partial<Record<SlotName, string>> {
  const slotIds: Partial<Record<SlotName, string>> = {};

  for (const [slot, snippet] of Object.entries(historySnippets) as Array<[SlotName, RetrievedPromptSnippet]>) {
    if (snippet.id) {
      slotIds[slot] = snippet.id;
    }
  }

  return slotIds;
}

function collectUsedHistoryIds(
  historySnippets: Partial<Record<SlotName, RetrievedPromptSnippet>>
): string[] {
  const ids = new Set<string>();

  for (const snippet of Object.values(historySnippets)) {
    if (snippet?.id) {
      ids.add(snippet.id);
    }
  }

  return [...ids];
}

function collectUsedHistoryTexts(
  historySnippets: Partial<Record<SlotName, RetrievedPromptSnippet>>
): string[] {
  const texts = new Set<string>();

  for (const snippet of Object.values(historySnippets)) {
    if (snippet?.text) {
      texts.add(snippet.text);
    }
  }

  return [...texts];
}

function renderContextEntries(values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");
}

function normalizeCandidate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^(?:(?:please|just)\s+)?(?:(?:optimi[sz]e|fix|review|check|build|create|implement|write|draft|explain|plan)\b\s*)+/i, "")
    .replace(/^(?:(?:优化|修复|检查|审查|构建|实现|写|起草|解释|规划)(?:一下|一下吧|一下子)*)+/i, "")
    .replace(/^(?:this|that|it|这个|那个|该|此)\s*/i, "")
    .replace(/^[：:,\s]+/, "")
    .replace(/[，。；;,.!?！？\s]+$/g, "")
    .replace(/^(?:并且|并|and)\s+/i, "");

  return normalized.length > 0 ? normalized : null;
}
