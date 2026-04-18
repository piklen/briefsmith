import test from "node:test";
import assert from "node:assert/strict";
import { detectMissingSlots } from "../../src/compiler/slot-detector.js";
import { compilePrompt } from "../../src/compiler/compiler.js";

test("detectMissingSlots flags vague prompts missing success criteria and constraints", () => {
  const result = detectMissingSlots("optimize this");

  assert.deepEqual(result.missing, ["target", "success_criteria", "constraints"]);
  assert.equal(result.needsFollowUp, true);
});

test("compilePrompt emits a structured task brief", () => {
  const output = compilePrompt({
    rawInput: "optimize this query",
    inferredDefaults: {
      preferred_language: "zh-CN"
    },
    followUpAnswers: {
      target: "orders query",
      success_criteria: "faster response time",
      constraints: "do not change external API"
    },
    retrievedPromptSnippets: [
      "优化 SQL 查询，并保留现有接口"
    ]
  });

  assert.equal(output.includes("Task Goal"), true);
  assert.equal(output.includes("orders query"), true);
  assert.equal(output.includes("do not change external API"), true);
});

test("detectMissingSlots recognizes Chinese constraint phrases", () => {
  const result = detectMissingSlots("优化这个导入逻辑，不要改变外部命令行为，输出任务说明");

  assert.equal(result.missing.includes("constraints"), false);
});
