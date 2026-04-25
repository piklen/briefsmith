import test from "node:test";
import assert from "node:assert/strict";
import { detectMissingSlots } from "../../src/compiler/slot-detector.js";
import { compileOrClarify, compilePrompt } from "../../src/compiler/compiler.js";

test("detectMissingSlots flags vague prompts missing success criteria and constraints", () => {
  const result = detectMissingSlots("optimize this");

  assert.deepEqual(result.missing, ["target", "success_criteria", "constraints", "verification"]);
  assert.equal(result.needsFollowUp, true);
});

test("detectMissingSlots treats continuation-only optimize requests as missing a target", () => {
  const result = detectMissingSlots("继续优化");

  assert.equal(result.missing.includes("target"), true);
});

test("detectMissingSlots treats polite action-only optimize requests as missing a target", () => {
  const result = detectMissingSlots("帮我优化");

  assert.equal(result.missing.includes("target"), true);
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
      constraints: "do not change external API",
      verification: "run the relevant test suite and confirm the API response stays unchanged"
    },
    retrievedPromptSnippets: [
      "优化 SQL 查询，并保留现有接口"
    ]
  });

  assert.equal(output.includes("Task Goal"), true);
  assert.equal(output.includes("orders query"), true);
  assert.equal(output.includes("do not change external API"), true);
  assert.equal(output.includes("run the relevant test suite"), true);
});

test("detectMissingSlots recognizes Chinese constraint phrases", () => {
  const result = detectMissingSlots("优化这个导入逻辑，不要改变外部命令行为，输出任务说明");

  assert.equal(result.missing.includes("constraints"), false);
});

test("detectMissingSlots flags bugfix prompts missing problem signals", () => {
  const result = detectMissingSlots("修复这个登录流程，不要改变外部接口，并运行相关测试验证");

  assert.equal(result.missing.includes("problem_signal"), true);
});

test("compileOrClarify auto-fills high-confidence optimize requests", () => {
  const result = compileOrClarify(
    "优化一下这个导入逻辑",
    {
      preferred_language: "zh-CN"
    },
    ["优化导入器并保持外部命令行为不变"]
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.resolvedSlots.target?.includes("导入逻辑"), true);
  assert.equal(result.resolvedSlots.constraints?.includes("外部行为"), true);
  assert.equal(result.resolvedSlots.success_criteria?.length ? true : false, true);
  assert.equal(result.resolvedSlots.verification?.includes("验证"), true);
  assert.equal(result.resolvedSlotConfidence.target, 0.96);
  assert.equal(result.resolvedSlotConfidence.success_criteria, 0.68);
  assert.equal(result.resolvedSlotConfidence.constraints, 0.82);
  assert.equal(result.resolvedSlotConfidence.verification, 0.78);
});

test("compileOrClarify keeps explicit constraints and verification in the compiled brief", () => {
  const result = compileOrClarify(
    "optimize this import flow, keep the external API unchanged, and verify with the relevant tests",
    {
      preferred_language: "en"
    },
    []
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.resolvedSlots.target?.includes("import flow"), true);
  assert.equal(result.resolvedSlots.constraints?.includes("external API"), true);
  assert.equal(result.resolvedSlots.verification?.includes("relevant tests"), true);
  assert.equal(result.text.includes("constraints"), true);
  assert.equal(result.text.includes("verification"), true);
});

test("compileOrClarify prefers the raw input language over a Chinese profile default", () => {
  const result = compileOrClarify(
    "optimize this import flow",
    {
      preferred_language: "zh-CN"
    },
    []
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.resolvedSlots.success_criteria?.includes("Improve readability"), true);
  assert.equal(result.resolvedSlots.verification?.includes("Run the relevant tests"), true);
});

test("compileOrClarify asks for problem signals on bugfix prompts without visible symptoms", () => {
  const result = compileOrClarify(
    "修复这个登录流程，不要改变外部接口，并运行相关测试验证",
    {
      preferred_language: "zh-CN"
    },
    []
  );

  assert.equal(result.kind, "questions");
  assert.equal(result.missing.includes("problem_signal"), true);
  assert.equal(result.followUpQuestions.some((question) => question.includes("现象")), true);
});

test("compileOrClarify can reuse continuation context from the latest same-project session", () => {
  const result = compileOrClarify(
    "继续优化",
    {
      preferred_language: "zh-CN"
    },
    [],
    {
      target: "导入逻辑",
      constraints: "不要改变外部命令行为",
      verification: "运行相关测试验证"
    }
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.resolvedSlots.target, "导入逻辑");
  assert.equal(result.resolvedSlots.constraints, "不要改变外部命令行为");
  assert.equal(result.resolvedSlots.verification, "运行相关测试验证");
  assert.equal(result.resolvedSlotSources.target, "session");
  assert.equal(result.resolvedSlotSources.constraints, "session");
  assert.equal(result.resolvedSlotSources.verification, "session");
});

test("compileOrClarify ignores meta conversational constraints from history", () => {
  const result = compileOrClarify(
    "帮我优化",
    {
      preferred_language: "zh-CN"
    },
    ["本项目想要做的事情是通过skill来帮助ai拿到的提示词更好，如果不能那需要让ai去问用户。"]
  );

  assert.equal(result.kind, "questions");
  assert.equal(result.resolvedSlots.constraints, undefined);
  assert.equal(result.resolvedSlotSources.constraints, undefined);
});

test("compileOrClarify tracks the exact history entry used for a resolved slot", () => {
  const result = compileOrClarify(
    "优化一下这个导入逻辑",
    {
      preferred_language: "zh-CN"
    },
    [
      {
        id: "codex:meta-history",
        text: "优化一下这个导入逻辑，如果不能那需要让ai去问用户。"
      },
      {
        id: "codex:constraint-history",
        text: "优化导入逻辑并保持外部命令行为不变"
      }
    ]
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.resolvedSlotSources.constraints, "history");
  assert.equal(result.resolvedSlotHistoryIds.constraints, "codex:constraint-history");
  assert.deepEqual(result.usedHistoryIds, ["codex:constraint-history"]);
  assert.equal(result.text.includes("优化导入逻辑并保持外部命令行为不变"), true);
  assert.equal(result.text.includes("如果不能那需要让ai去问用户"), false);
});

test("compileOrClarify labels inferred slot sources and confidence in compiled briefs", () => {
  const result = compileOrClarify(
    "优化一下这个导入逻辑",
    {
      preferred_language: "zh-CN"
    },
    [
      {
        id: "codex:constraint-history",
        text: "优化导入逻辑并保持外部命令行为不变"
      }
    ]
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.text.includes("- target [input, confidence 0.96]:"), true);
  assert.equal(result.text.includes("- default_success_direction [heuristic, confidence 0.68]:"), true);
  assert.equal(result.text.includes("- constraints [history, confidence 0.82, history codex:constraint-history]:"), true);
  assert.equal(result.text.includes("- verification [heuristic, confidence 0.78]:"), true);
});

test("compileOrClarify renders heuristic success criteria as default success direction", () => {
  const result = compileOrClarify(
    "optimize this import flow, keep the external API unchanged, and verify with the relevant tests",
    {
      preferred_language: "en"
    },
    []
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.text.includes("- default_success_direction [heuristic, confidence 0.68]:"), true);
  assert.equal(result.text.includes("- success_criteria [heuristic"), false);
});

test("compileOrClarify keeps explicit success criteria labeled as success criteria", () => {
  const result = compileOrClarify(
    "optimize this import flow, success means duplicate parsing happens only once, keep the external API unchanged, and verify with the relevant tests",
    {
      preferred_language: "en"
    },
    []
  );

  assert.equal(result.kind, "compiled");
  assert.equal(result.text.includes("- success_criteria [input, confidence 0.96]:"), true);
  assert.equal(result.text.includes("- default_success_direction"), false);
});
