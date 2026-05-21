import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AuditResult } from "../src/audit";
import { parseActionConfig } from "../src/config";
import { formatJsonReport, formatMarkdownReport, formatReport, writeMarkdownSummary } from "../src/report";
import type { toJsonReport } from "../src/report";

describe("report formatting", () => {
  it("renders text score, checks, warnings, and recommendations", () => {
    const result = createReportFixture();

    const report = formatReport(result, { colors: false });

    expect(report).toContain("RepoPulse Open Source Health Audit");
    expect(report).toContain("Score: 80/100 (minimum: 70) PASS");
    expect(report).toContain("[PASS] readme - README.md (12/12)");
    expect(report).toContain("[MISS] readme-funding - Sponsors or Funding (0/8)");
    expect(report).toContain("[SKIP] funding - .github/FUNDING.yml (excluded)");
    expect(report).toContain("Add funding details.");
  });

  it("renders Markdown summary with a checks table", () => {
    const report = formatMarkdownReport(createReportFixture());

    expect(report).toContain("## RepoPulse Open Source Health Audit");
    expect(report).toContain("| Status | ID | Category | Check | Points | Detail |");
    expect(report).toContain(
      "| MISS | `readme-funding` | readme-section | Sponsors or Funding | 0/8 | Section missing |"
    );
    expect(report).toContain("### Recommendations");
  });

  it("serializes a valid JSON report", () => {
    const result = createReportFixture();
    const json = formatJsonReport(result);
    const parsed = JSON.parse(json) as ReturnType<typeof toJsonReport>;

    expect(parsed.score).toBe(80);
    expect(parsed.passed).toBe(true);
    expect(parsed.checks[0]?.id).toBe("readme");
    expect(parsed.config.minScore).toBe(70);
  });

  it("writes Markdown summary when a summary path is available", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "repopulse-summary-"));
    const summaryPath = path.join(directory, "summary.md");

    try {
      await expect(writeMarkdownSummary(summaryPath, createReportFixture())).resolves.toBe(true);
      await expect(writeMarkdownSummary(undefined, createReportFixture())).resolves.toBe(false);

      const summary = await readFile(summaryPath, "utf8");
      expect(summary).toContain("## RepoPulse Open Source Health Audit");
      expect(summary).toContain("### Checks");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function createReportFixture(): AuditResult {
  const config = parseActionConfig({ excludeChecks: "funding" });
  const files: AuditResult["files"] = [
    {
      id: "readme",
      category: "file",
      label: "README.md",
      points: 12,
      earned: 12,
      passed: true,
      status: "pass",
      excluded: false,
      recommendation: "Add README.md.",
      detail: "Found non-empty README.md"
    },
    {
      id: "funding",
      category: "file",
      label: ".github/FUNDING.yml",
      points: 0,
      earned: 0,
      passed: false,
      status: "excluded",
      excluded: true,
      recommendation: "Add funding details.",
      detail: "Excluded by configuration"
    }
  ];
  const readmeSections: AuditResult["readmeSections"] = [
    {
      id: "readme-funding",
      category: "readme-section",
      label: "Sponsors or Funding",
      points: 8,
      earned: 0,
      passed: false,
      status: "fail",
      excluded: false,
      recommendation: "Add funding details.",
      detail: "Section missing"
    }
  ];

  return {
    score: 80,
    passed: true,
    earnedPoints: 80,
    maxPoints: 100,
    files,
    readmeSections,
    checks: [...files, ...readmeSections],
    warnings: ["[readme-funding] Section missing"],
    recommendations: ["Add funding details."],
    config
  };
}
