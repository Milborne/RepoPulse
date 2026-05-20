import { describe, expect, it } from "vitest";
import type { AuditResult } from "../src/audit";
import { formatReport } from "../src/report";

describe("formatReport", () => {
  it("renders score, checks, and recommendations", () => {
    const result: AuditResult = {
      score: 80,
      earnedPoints: 80,
      maxPoints: 100,
      files: [
        {
          id: "readme",
          category: "file",
          label: "README.md",
          points: 12,
          earned: 12,
          passed: true,
          recommendation: "Add README.md.",
          detail: "Found"
        }
      ],
      readmeSections: [
        {
          id: "readme-funding",
          category: "readme-section",
          label: "Sponsors or Funding",
          points: 8,
          earned: 0,
          passed: false,
          recommendation: "Add funding details.",
          detail: "Section missing"
        }
      ],
      warnings: ["README.md missing section: Sponsors or Funding"],
      recommendations: ["Add funding details."]
    };

    const report = formatReport(result, 70, { colors: false });

    expect(report).toContain("RepoPulse Open Source Health Audit");
    expect(report).toContain("Score: 80/100 (minimum: 70) PASS");
    expect(report).toContain("[PASS] README.md (12/12)");
    expect(report).toContain("[MISS] Sponsors or Funding (0/8)");
    expect(report).toContain("Add funding details.");
  });
});
