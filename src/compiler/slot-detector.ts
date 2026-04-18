import type { MissingSlotResult, SlotName } from "../core/types.js";

const SUCCESS_PATTERN = /(so that|success|expected|faster|readability|performance|性能|结果|标准|减少|提升|合并|消除重复|更快|更清晰)/i;
const CONSTRAINT_PATTERN = /(without|must|keep|do not|don't|保持|不要|不能|不改变|不修改|保留)/i;
const OUTPUT_PATTERN = /(return|output|format|markdown|json|列表|表格|文档|说明|任务说明)/i;
const DOCUMENT_STYLE_PATTERN = /(write|draft|document|report|spec|plan|总结|文档|方案|说明)/i;
const TARGET_PATTERN = /\b(this|it|that)\b|这个|那个/i;

export function detectMissingSlots(rawInput: string): MissingSlotResult {
  const input = rawInput.trim();
  const missing: SlotName[] = [];

  if (input.length === 0 || TARGET_PATTERN.test(input)) {
    missing.push("target");
  }

  if (!SUCCESS_PATTERN.test(input)) {
    missing.push("success_criteria");
  }

  if (!CONSTRAINT_PATTERN.test(input)) {
    missing.push("constraints");
  }

  if (DOCUMENT_STYLE_PATTERN.test(input) && !OUTPUT_PATTERN.test(input)) {
    missing.push("output_format");
  }

  return {
    missing,
    needsFollowUp: missing.length >= 2
  };
}
