import type { SlotName } from "../core/types.js";

const QUESTIONS: Record<SlotName, string> = {
  target: "你具体要处理的对象是什么？",
  problem_signal: "你现在看到的具体现象是什么？例如报错、异常行为、性能下降、回归或日志信号。",
  success_criteria: "你希望最终达到什么结果或成功标准？",
  constraints: "有没有不能动的边界、风险限制或兼容性要求？",
  verification: "完成后你希望怎么验证结果？例如测试、回归检查、基准对比或人工检查。",
  output_format: "你希望我以什么输出形式交付？"
};

export function buildFollowUpQuestions(missing: SlotName[]): string[] {
  return missing.map((slot) => QUESTIONS[slot]);
}
