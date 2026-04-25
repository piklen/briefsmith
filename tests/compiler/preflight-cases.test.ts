import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SlotName } from "../../src/core/types.js";
import { compileOrClarify } from "../../src/compiler/compiler.js";

type ExpectedAction = "ask" | "compile";

interface PreflightCase {
  id: string;
  reason: string;
  rawInput: string;
  inferredDefaults?: Record<string, unknown>;
  history?: Array<{
    id: string;
    text: string;
  }>;
  continuationSlots?: Partial<Record<SlotName, string>>;
  expected: {
    action: ExpectedAction;
    missing?: SlotName[];
    resolvedSlots?: Partial<Record<SlotName, string>>;
    usedHistoryIds?: string[];
    historySlotIds?: Partial<Record<SlotName, string>>;
  };
}

const CASES_PATH = join(process.cwd(), "tests", "fixtures", "preflight-cases", "cases.json");

test("preflight golden cases document expected ask/compile decisions", () => {
  const cases = JSON.parse(readFileSync(CASES_PATH, "utf8")) as PreflightCase[];

  assert.equal(cases.length >= 8, true, "golden cases should cover the core decision surface");

  for (const item of cases) {
    assert.equal(item.reason.trim().length > 0, true, `${item.id} must explain why the expected action is correct`);

    const decision = compileOrClarify(
      item.rawInput,
      item.inferredDefaults ?? {},
      item.history ?? [],
      item.continuationSlots ?? {}
    );
    const action: ExpectedAction = decision.kind === "questions" ? "ask" : "compile";

    assert.equal(action, item.expected.action, item.id);

    if (item.expected.missing) {
      assert.deepEqual(decision.missing, item.expected.missing, item.id);
    }

    for (const [slot, expectedValue] of Object.entries(item.expected.resolvedSlots ?? {}) as Array<[SlotName, string]>) {
      assert.equal(decision.resolvedSlots[slot], expectedValue, item.id);
    }

    if (item.expected.usedHistoryIds) {
      assert.deepEqual(decision.usedHistoryIds, item.expected.usedHistoryIds, item.id);
    }

    for (const [slot, expectedHistoryId] of Object.entries(item.expected.historySlotIds ?? {}) as Array<[SlotName, string]>) {
      assert.equal(decision.resolvedSlotHistoryIds[slot], expectedHistoryId, item.id);
    }
  }
});
