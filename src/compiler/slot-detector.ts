import type { MissingSlotResult, SlotName } from "../core/types.js";

const SUCCESS_PATTERN = /(so that|success|expected|faster|readability|performance|性能|结果|标准|减少|提升|合并|消除重复|更快|更清晰)/i;
const CONSTRAINT_PATTERN = /(without|must|keep|do not|don't|保持|不要|不能|不改变|不修改|保留)/i;
const VERIFICATION_PATTERN = /(test|tests|testing|verify|verification|validated|validation|benchmark|benchmarks|measure|measured|regression|smoke test|assert|测试|验证|回归|基准|压测|对比|复现|复测)/i;
const OUTPUT_PATTERN = /(return|output|format|markdown|json|列表|表格|文档|说明|任务说明)/i;
const DOCUMENT_STYLE_PATTERN = /(write|draft|document|report|spec|plan|总结|文档|方案|说明)/i;
const EXECUTION_ACTION_PATTERN = /(optimi[sz]e|fix|build|create|implement|refactor|improve|simplify|clean up|optimize|优化|修复|构建|实现|重构|改进|简化)/i;
const TARGET_PATTERN = /\b(this|it|that)\b|这个|那个/i;
const ACTION_ONLY_PATTERN = /^(?:(?:please|just)\s+)?(?:optimi[sz]e|fix|review|check|build|create|implement|write|draft|explain|plan|优化|修复|检查|审查|构建|实现|写|起草|解释|规划)(?:\s+(?:it|this|that)|一下|一下吧|一下子)?[\s!,.?，。？]*$/i;

export function detectMissingSlots(rawInput: string): MissingSlotResult {
  const input = rawInput.trim();
  const missing: SlotName[] = [];

  if (input.length === 0 || TARGET_PATTERN.test(input) || ACTION_ONLY_PATTERN.test(input)) {
    missing.push("target");
  }

  if (!SUCCESS_PATTERN.test(input)) {
    missing.push("success_criteria");
  }

  if (!CONSTRAINT_PATTERN.test(input)) {
    missing.push("constraints");
  }

  if (EXECUTION_ACTION_PATTERN.test(input) && !VERIFICATION_PATTERN.test(input)) {
    missing.push("verification");
  }

  if (DOCUMENT_STYLE_PATTERN.test(input) && !OUTPUT_PATTERN.test(input)) {
    missing.push("output_format");
  }

  return {
    missing,
    needsFollowUp: missing.length >= 2
  };
}
