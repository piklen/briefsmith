import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowUpQuestions } from "../../src/compiler/clarifier.js";

test("buildFollowUpQuestions compresses multi-slot English asks into one contextual question", () => {
  const questions = buildFollowUpQuestions({
    rawInput: "fix this checkout flow",
    missing: ["problem_signal", "success_criteria", "constraints"],
    resolvedSlots: {
      target: "checkout flow"
    }
  });

  assert.equal(questions.length, 1);
  assert.equal(/checkout flow/i.test(questions[0]), true);
  assert.equal(/symptom/i.test(questions[0]), true);
  assert.equal(/success/i.test(questions[0]), true);
  assert.equal(/unchanged|boundary|constraint/i.test(questions[0]), true);
});

test("buildFollowUpQuestions keeps Chinese wording for Chinese asks and compresses multiple slots", () => {
  const questions = buildFollowUpQuestions({
    rawInput: "优化一下",
    missing: ["target", "success_criteria", "constraints"]
  });

  assert.equal(questions.length, 1);
  assert.equal(questions[0].includes("请一次补充"), true);
  assert.equal(questions[0].includes("具体要处理"), true);
  assert.equal(questions[0].includes("成功标准"), true);
  assert.equal(questions[0].includes("不能动"), true);
});

test("buildFollowUpQuestions keeps a single direct question when only one slot is missing", () => {
  const questions = buildFollowUpQuestions({
    rawInput: "修复这个登录流程",
    missing: ["problem_signal"],
    resolvedSlots: {
      target: "登录流程"
    }
  });

  assert.deepEqual(questions, [
    "登录流程现在看到的具体现象是什么？例如报错、异常行为、性能下降、回归或日志信号。"
  ]);
});
