import type { SlotName } from "../core/types.js";

const QUESTIONS: Record<SlotName, string> = {
  target: "你具体要处理的对象是什么？",
  success_criteria: "你希望最终达到什么结果或成功标准？",
  constraints: "有没有不能动的边界、风险限制或兼容性要求？",
  output_format: "你希望我以什么输出形式交付？"
};

export function buildFollowUpQuestions(missing: SlotName[]): string[] {
  return missing.map((slot) => QUESTIONS[slot]);
}
