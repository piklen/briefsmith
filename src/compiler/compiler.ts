import type { CompileDecision, CompilePromptInput, SlotName, SlotResolutionSource } from "../core/types.js";
import { buildFollowUpQuestions } from "./clarifier.js";
import { detectMissingSlots } from "./slot-detector.js";

const CHINESE_PATTERN = /[\u4e00-\u9fff]/;
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
const HEURISTIC_CONFIDENCE = 0.68;
const DEFAULT_CONFIDENCE = 0.55;

export function compilePrompt(input: CompilePromptInput): string {
  const defaults = Object.entries(input.inferredDefaults)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");

  const answers = Object.entries(input.followUpAnswers)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

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
    "- preserve risk boundaries from the resolved context"
  ].join("\n");
}

export function compileOrClarify(
  rawInput: string,
  inferredDefaults: Record<string, unknown>,
  retrievedPromptSnippets: string[]
): CompileDecision {
  const missingResult = detectMissingSlots(rawInput);
  const resolution = resolveMissingSlots(
    rawInput,
    missingResult.missing,
    inferredDefaults,
    retrievedPromptSnippets
  );
  const resolvedSlots = resolution.values;
  const unresolved = missingResult.missing.filter((slot) => !resolvedSlots[slot]);
  const followUpQuestions = buildFollowUpQuestions(unresolved);

  if (shouldAskFollowUp(unresolved)) {
    return {
      kind: "questions",
      text: followUpQuestions.join("\n"),
      missing: unresolved,
      initialMissing: missingResult.missing,
      resolvedSlots,
      resolvedSlotSources: resolution.sources,
      resolvedSlotConfidence: resolution.confidence,
      followUpQuestions
    };
  }

  const compiled = compilePrompt({
    rawInput,
    inferredDefaults,
    followUpAnswers: resolvedSlots,
    retrievedPromptSnippets
  });

  return {
    kind: "compiled",
    text: compiled,
    missing: [],
    initialMissing: missingResult.missing,
    resolvedSlots,
    resolvedSlotSources: resolution.sources,
    resolvedSlotConfidence: resolution.confidence,
    followUpQuestions: []
  };
}

function resolveMissingSlots(
  rawInput: string,
  missing: SlotName[],
  inferredDefaults: Record<string, unknown>,
  retrievedPromptSnippets: string[]
): {
  values: Partial<Record<SlotName, string>>;
  sources: Partial<Record<SlotName, SlotResolutionSource>>;
  confidence: Partial<Record<SlotName, number>>;
} {
  const values: Partial<Record<SlotName, string>> = {};
  const sources: Partial<Record<SlotName, SlotResolutionSource>> = {};
  const confidence: Partial<Record<SlotName, number>> = {};

  for (const slot of missing) {
    if (slot === "target") {
      const target = inferTarget(rawInput);
      if (target) {
        values.target = target.value;
        sources.target = target.source;
        confidence.target = target.confidence;
      }
      continue;
    }

    if (slot === "success_criteria") {
      const success = inferSuccessCriteria(rawInput, inferredDefaults);
      if (success) {
        values.success_criteria = success.value;
        sources.success_criteria = success.source;
        confidence.success_criteria = success.confidence;
      }
      continue;
    }

    if (slot === "constraints") {
      const constraint = inferConstraint(rawInput, retrievedPromptSnippets);
      if (constraint) {
        values.constraints = constraint.value;
        sources.constraints = constraint.source;
        confidence.constraints = constraint.confidence;
      }
      continue;
    }

    if (slot === "output_format") {
      values.output_format = prefersChinese(rawInput, inferredDefaults)
        ? "结构化任务说明"
        : "Structured task brief";
      sources.output_format = "default";
      confidence.output_format = DEFAULT_CONFIDENCE;
    }
  }

  return { values, sources, confidence };
}

function shouldAskFollowUp(unresolved: SlotName[]): boolean {
  return unresolved.includes("target") || unresolved.length >= 2;
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

function inferConstraint(
  rawInput: string,
  retrievedPromptSnippets: string[]
): { value: string; source: SlotResolutionSource; confidence: number } | null {
  const direct = extractConstraint(rawInput);
  if (direct) {
    return { value: direct, source: "input", confidence: INPUT_CONFIDENCE };
  }

  for (const snippet of retrievedPromptSnippets) {
    const fromHistory = extractConstraint(snippet);
    if (fromHistory) {
      return { value: fromHistory, source: "history", confidence: HISTORY_CONFIDENCE };
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

function prefersChinese(rawInput: string, inferredDefaults: Record<string, unknown>): boolean {
  return CHINESE_PATTERN.test(rawInput) || inferredDefaults.preferred_language === "zh-CN";
}

function normalizeCandidate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^(?:(?:please|just)\s+)?(?:optimi[sz]e|fix|review|check|build|create|implement|write|draft|explain|plan|优化|修复|检查|审查|构建|实现|写|起草|解释|规划)(?:\s+|一下|一下吧|一下子)*/i, "")
    .replace(/^(?:this|that|it|这个|那个|该|此)\s*/i, "")
    .replace(/^[：:,\s]+/, "")
    .replace(/[，。；;,.!?！？\s]+$/g, "")
    .replace(/^(?:并且|并|and)\s+/i, "");

  return normalized.length > 0 ? normalized : null;
}
