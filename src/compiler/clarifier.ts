import type { SlotName } from "../core/types.js";
import { prefersChinese } from "./language.js";

interface FollowUpQuestionInput {
  rawInput: string;
  missing: SlotName[];
  resolvedSlots?: Partial<Record<SlotName, string>>;
  inferredDefaults?: Record<string, unknown>;
}

export function buildFollowUpQuestions(input: FollowUpQuestionInput): string[] {
  const missing = input.missing;
  if (missing.length === 0) {
    return [];
  }

  const target = input.resolvedSlots?.target;
  const useChinese = prefersChinese(input.rawInput, input.inferredDefaults);

  if (missing.length === 1) {
    return [buildSingleQuestion(missing[0], target, useChinese)];
  }

  return [buildCombinedQuestion(missing, target, useChinese)];
}

function buildSingleQuestion(slot: SlotName, target: string | undefined, useChinese: boolean): string {
  if (useChinese) {
    if (slot === "target") {
      return "你具体要处理的对象是什么？";
    }

    if (slot === "problem_signal") {
      return `${target ?? "你"}现在看到的具体现象是什么？例如报错、异常行为、性能下降、回归或日志信号。`;
    }

    if (slot === "success_criteria") {
      return "你希望最终达到什么结果或成功标准？";
    }

    if (slot === "constraints") {
      return "有没有不能动的边界、风险限制或兼容性要求？";
    }

    if (slot === "verification") {
      return "完成后你希望怎么验证结果？例如测试、回归检查、基准对比或人工检查。";
    }

    return "你希望我以什么输出形式交付？";
  }

  if (slot === "target") {
    return "What exact area or object should I work on?";
  }

  if (slot === "problem_signal") {
    return target
      ? `What exact symptom are you seeing in ${target}? For example errors, broken behavior, regressions, slowdowns, or log signals.`
      : "What exact symptom are you seeing? For example errors, broken behavior, regressions, slowdowns, or log signals.";
  }

  if (slot === "success_criteria") {
    return "What result would count as success?";
  }

  if (slot === "constraints") {
    return "What must stay unchanged, or what boundaries should I respect?";
  }

  if (slot === "verification") {
    return "How should I verify the result when it is done? For example tests, regression checks, benchmarks, or manual checks.";
  }

  return "What output format do you want back?";
}

function buildCombinedQuestion(missing: SlotName[], target: string | undefined, useChinese: boolean): string {
  const fragments = missing.map((slot, index) => `${index + 1}. ${buildQuestionFragment(slot, target, useChinese)}`);

  if (useChinese) {
    const scope = target ? `「${target}」` : "这次请求";
    return `为了避免猜错${scope}，请一次补充这${missing.length}点：${fragments.join(" ")}`;
  }

  const scope = target ? ` on ${target}` : "";
  return `Before I guess wrong${scope}, please give me these ${missing.length} things in one reply: ${fragments.join(" ")}`;
}

function buildQuestionFragment(slot: SlotName, target: string | undefined, useChinese: boolean): string {
  if (useChinese) {
    if (slot === "target") {
      return "具体要处理的对象是什么";
    }

    if (slot === "problem_signal") {
      return `${target ?? "你现在"}看到的具体现象是什么`;
    }

    if (slot === "success_criteria") {
      return "你希望最终达到什么结果或成功标准";
    }

    if (slot === "constraints") {
      return "有没有不能动的边界、风险限制或兼容性要求";
    }

    if (slot === "verification") {
      return "完成后你希望怎么验证结果";
    }

    return "你希望我以什么输出形式交付";
  }

  if (slot === "target") {
    return "what exact area or object I should work on";
  }

  if (slot === "problem_signal") {
    return target
      ? `what exact symptom you are seeing in ${target}`
      : "what exact symptom you are seeing";
  }

  if (slot === "success_criteria") {
    return "what result would count as success";
  }

  if (slot === "constraints") {
    return "what must stay unchanged or what boundaries I should respect";
  }

  if (slot === "verification") {
    return "how the result should be verified";
  }

  return "what output format you want back";
}
