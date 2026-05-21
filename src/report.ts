import { promises as fs } from "node:fs";
import type { AuditResult, CheckResult } from "./audit";

interface ReportOptions {
  colors?: boolean;
}

export interface JsonReport {
  score: number;
  passed: boolean;
  earnedPoints: number;
  maxPoints: number;
  checks: CheckResult[];
  warnings: string[];
  recommendations: string[];
  config: AuditResult["config"];
}

const colorCodes = {
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  bold: "\u001b[1m",
  reset: "\u001b[0m"
} as const;

export function formatTextReport(result: AuditResult, options: ReportOptions = {}): string {
  const colors = options.colors ?? true;
  const lines = [
    "",
    color("bold", "RepoPulse Open Source Health Audit", colors),
    color(
      result.passed ? "green" : "red",
      `Score: ${result.score}/100 (minimum: ${result.config.minScore}) ${result.passed ? "PASS" : "FAIL"}`,
      colors
    ),
    `Mode: ${result.config.strictMode ? "strict" : "standard"} | Format: ${result.config.format} | Fail on missing: ${result.config.failOnMissing}`,
    "",
    color("cyan", "Repository files", colors),
    ...result.files.map((check) => formatTextCheck(check, colors)),
    "",
    color("cyan", "README sections", colors),
    ...result.readmeSections.map((check) => formatTextCheck(check, colors))
  ];

  if (result.warnings.length > 0) {
    lines.push("", color("yellow", "Warnings", colors));
    lines.push(...result.warnings.map((warning) => `  - ${warning}`));
  }

  if (result.recommendations.length > 0) {
    lines.push("", color("yellow", "Recommendations", colors));
    lines.push(...result.recommendations.map((recommendation) => `  - ${recommendation}`));
  }

  return lines.join("\n");
}

export function formatMarkdownReport(result: AuditResult): string {
  const status = result.passed ? "PASS" : "FAIL";
  const lines = [
    "## RepoPulse Open Source Health Audit",
    "",
    `**Score:** ${result.score}/100`,
    `**Status:** ${status}`,
    `**Minimum score:** ${result.config.minScore}`,
    "",
    "### Configuration",
    "",
    "| Setting | Value |",
    "| --- | --- |",
    `| strict-mode | \`${result.config.strictMode}\` |`,
    `| fail-on-missing | \`${result.config.failOnMissing}\` |`,
    `| format | \`${result.config.format}\` |`,
    `| readme-language | \`${result.config.readmeLanguage}\` |`,
    `| job-summary | \`${result.config.jobSummary}\` |`,
    `| exclude-checks | ${formatInlineList(result.config.excludeChecks)} |`,
    `| custom-weights | ${formatCustomWeights(result.config.customWeights)} |`,
    "",
    "### Checks",
    "",
    "| Status | ID | Category | Check | Points | Detail |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...result.checks.map(formatMarkdownCheck)
  ];

  if (result.warnings.length > 0) {
    lines.push("", "### Warnings", "", ...result.warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
  }

  if (result.recommendations.length > 0) {
    lines.push(
      "",
      "### Recommendations",
      "",
      ...result.recommendations.map((recommendation) => `- ${escapeMarkdown(recommendation)}`)
    );
  }

  return lines.join("\n");
}

export function toJsonReport(result: AuditResult): JsonReport {
  return {
    score: result.score,
    passed: result.passed,
    earnedPoints: result.earnedPoints,
    maxPoints: result.maxPoints,
    checks: result.checks,
    warnings: result.warnings,
    recommendations: result.recommendations,
    config: result.config
  };
}

export function formatJsonReport(result: AuditResult, pretty = true): string {
  return JSON.stringify(toJsonReport(result), null, pretty ? 2 : 0);
}

export async function writeMarkdownSummary(
  summaryPath: string | undefined,
  result: AuditResult
): Promise<boolean> {
  if (!summaryPath) {
    return false;
  }

  try {
    await fs.appendFile(summaryPath, `${formatMarkdownReport(result)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function formatReport(result: AuditResult, options: ReportOptions = {}): string {
  return formatTextReport(result, options);
}

function formatTextCheck(check: CheckResult, colors: boolean): string {
  const status = getDisplayStatus(check);
  const colorName = check.status === "pass" ? "green" : check.status === "warning" ? "yellow" : "red";
  const renderedStatus = check.status === "excluded" ? "SKIP" : color(colorName, status, colors);
  const points = check.excluded ? "excluded" : `${check.earned}/${check.points}`;

  return `  [${renderedStatus}] ${check.id} - ${check.label} (${points}) - ${check.detail}`;
}

function formatMarkdownCheck(check: CheckResult): string {
  const points = check.excluded ? "excluded" : `${check.earned}/${check.points}`;

  return [
    getDisplayStatus(check),
    `\`${check.id}\``,
    check.category,
    escapeMarkdown(check.label),
    points,
    escapeMarkdown(check.detail)
  ]
    .map((value) => String(value).replace(/\|/g, "\\|"))
    .join(" | ")
    .replace(/^/, "| ")
    .replace(/$/, " |");
}

function getDisplayStatus(check: CheckResult): string {
  switch (check.status) {
    case "pass":
      return "PASS";
    case "fail":
      return "MISS";
    case "warning":
      return "WARN";
    case "excluded":
      return "SKIP";
  }
}

function formatInlineList(values: string[]): string {
  if (values.length === 0) {
    return "_none_";
  }

  return values.map((value) => `\`${value}\``).join(", ");
}

function formatCustomWeights(weights: Record<string, number>): string {
  const entries = Object.entries(weights);

  if (entries.length === 0) {
    return "_none_";
  }

  return entries.map(([id, weight]) => `\`${id}: ${weight}\``).join(", ");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function color(name: keyof typeof colorCodes, value: string, enabled: boolean): string {
  if (!enabled) {
    return value;
  }

  return `${colorCodes[name]}${value}${colorCodes.reset}`;
}
