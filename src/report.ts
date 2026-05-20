import type { AuditResult, CheckResult } from "./audit";

interface ReportOptions {
  colors?: boolean;
}

const colorCodes = {
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  bold: "\u001b[1m",
  reset: "\u001b[0m"
} as const;

export function formatReport(result: AuditResult, minScore: number, options: ReportOptions = {}): string {
  const passed = result.score >= minScore;
  const colors = options.colors ?? true;
  const lines = [
    "",
    color("bold", "RepoPulse Open Source Health Audit", colors),
    color(passed ? "green" : "red", `Score: ${result.score}/100 (minimum: ${minScore}) ${passed ? "PASS" : "FAIL"}`, colors),
    "",
    color("cyan", "Repository files", colors),
    ...result.files.map((check) => formatCheck(check, colors)),
    "",
    color("cyan", "README sections", colors),
    ...result.readmeSections.map((check) => formatCheck(check, colors))
  ];

  if (result.recommendations.length > 0) {
    lines.push("", color("yellow", "Recommendations", colors));
    lines.push(...result.recommendations.map((recommendation) => `  - ${recommendation}`));
  }

  return lines.join("\n");
}

function formatCheck(check: CheckResult, colors: boolean): string {
  const status = check.passed ? color("green", "PASS", colors) : color("red", "MISS", colors);
  const points = `${check.earned}/${check.points}`;

  return `  [${status}] ${check.label} (${points}) - ${check.detail}`;
}

function color(name: keyof typeof colorCodes, value: string, enabled: boolean): string {
  if (!enabled) {
    return value;
  }

  return `${colorCodes[name]}${value}${colorCodes.reset}`;
}

