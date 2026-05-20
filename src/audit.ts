import { promises as fs } from "node:fs";
import path from "node:path";
import { FILE_CHECKS, README_SECTION_CHECKS, type AuditCheck, type CheckCategory } from "./checks";

export interface CheckResult {
  id: string;
  category: CheckCategory;
  label: string;
  points: number;
  earned: number;
  passed: boolean;
  recommendation: string;
  detail: string;
}

export interface AuditResult {
  score: number;
  earnedPoints: number;
  maxPoints: number;
  files: CheckResult[];
  readmeSections: CheckResult[];
  warnings: string[];
  recommendations: string[];
}

export async function auditRepository(repositoryPath: string): Promise<AuditResult> {
  const fileResults = await Promise.all(
    FILE_CHECKS.map(async (check) => {
      const exists = await pathExists(path.join(repositoryPath, check.path));

      return toCheckResult({
        check,
        category: "file",
        passed: exists,
        detail: exists ? "Found" : "Missing"
      });
    })
  );

  const readmePath = path.join(repositoryPath, "README.md");
  const readmeExists = fileResults.find((result) => result.id === "readme")?.passed ?? false;
  const readmeContent = readmeExists ? await fs.readFile(readmePath, "utf8") : "";

  const readmeResults = README_SECTION_CHECKS.map((check) => {
    const passed = readmeExists && check.patterns.some((pattern) => pattern.test(readmeContent));

    return toCheckResult({
      check,
      category: "readme-section",
      passed,
      detail: getReadmeSectionDetail(readmeExists, passed)
    });
  });

  const allResults = [...fileResults, ...readmeResults];
  const earnedPoints = allResults.reduce((sum, result) => sum + result.earned, 0);
  const maxPoints = allResults.reduce((sum, result) => sum + result.points, 0);
  const score = maxPoints === 0 ? 0 : Math.round((earnedPoints / maxPoints) * 100);
  const failedResults = allResults.filter((result) => !result.passed);

  return {
    score,
    earnedPoints,
    maxPoints,
    files: fileResults,
    readmeSections: readmeResults,
    warnings: failedResults.map(formatWarning),
    recommendations: failedResults.map((result) => result.recommendation)
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function toCheckResult(options: {
  check: AuditCheck;
  category: CheckCategory;
  passed: boolean;
  detail: string;
}): CheckResult {
  return {
    id: options.check.id,
    category: options.category,
    label: options.check.label,
    points: options.check.points,
    earned: options.passed ? options.check.points : 0,
    passed: options.passed,
    recommendation: options.check.recommendation,
    detail: options.detail
  };
}

function formatWarning(result: CheckResult): string {
  if (result.category === "file") {
    return `Missing file: ${result.label}`;
  }

  return `README.md missing section: ${result.label}`;
}

function getReadmeSectionDetail(readmeExists: boolean, sectionPassed: boolean): string {
  if (!readmeExists) {
    return "README.md missing";
  }

  return sectionPassed ? "Section detected" : "Section missing";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
