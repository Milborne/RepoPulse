import { describe, expect, it } from "vitest";
import type { AuditResult } from "../src/audit";
import { parseActionConfig } from "../src/config";
import { shouldFailWorkflow } from "../src/index";

describe("shouldFailWorkflow", () => {
  it("fails only when the score is below min-score and fail-on-missing is enabled", () => {
    expect(shouldFailWorkflow(createResult(false, true))).toBe(true);
    expect(shouldFailWorkflow(createResult(false, false))).toBe(false);
    expect(shouldFailWorkflow(createResult(true, true))).toBe(false);
  });
});

function createResult(passed: boolean, failOnMissing: boolean): AuditResult {
  return {
    score: passed ? 100 : 50,
    passed,
    earnedPoints: passed ? 100 : 50,
    maxPoints: 100,
    files: [],
    readmeSections: [],
    checks: [],
    warnings: [],
    recommendations: [],
    config: parseActionConfig({ failOnMissing: String(failOnMissing) })
  };
}
