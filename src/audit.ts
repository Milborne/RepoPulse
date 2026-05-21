import { promises as fs } from "node:fs";
import path from "node:path";
import {
  FILE_CHECKS,
  README_SECTION_CHECKS,
  type AuditCheckDefinition,
  type CheckCategory,
  type ExpectedPathType,
  type ReadmeSectionCheckDefinition
} from "./checks";
import { parseActionConfig, type AuditConfig } from "./config";

export type CheckStatus = "pass" | "fail" | "warning" | "excluded";

export interface CheckResult {
  id: string;
  category: CheckCategory;
  label: string;
  points: number;
  earned: number;
  passed: boolean;
  status: CheckStatus;
  excluded: boolean;
  recommendation: string;
  detail: string;
}

export interface AuditResult {
  score: number;
  passed: boolean;
  earnedPoints: number;
  maxPoints: number;
  files: CheckResult[];
  readmeSections: CheckResult[];
  checks: CheckResult[];
  warnings: string[];
  recommendations: string[];
  config: AuditConfig;
}

interface PathInspection {
  exists: boolean;
  validType: boolean;
  actualType?: ExpectedPathType;
  detail: string;
}

interface ValidationResult {
  status: Exclude<CheckStatus, "excluded">;
  detail: string;
  recommendation?: string;
}

interface IssueTemplateFile {
  filePath: string;
  content: string;
}

const PLACEHOLDER_PATTERN =
  /\b(?:tu_usuario_github|your[-_\s]?username|username|example|todo|tbd|changeme|replace[-_\s]?me)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PRIVATE_REPORTING_PATTERN =
  /\b(?:private vulnerability reporting|privately|security advisory|github security advisories|report privately)\b/i;
const MIN_LICENSE_LENGTH = 20;

export async function auditRepository(
  repositoryPath: string,
  config: AuditConfig = parseActionConfig({})
): Promise<AuditResult> {
  const fileResults = await Promise.all(
    FILE_CHECKS.map((check) => evaluateFileCheck(repositoryPath, applyWeight(check, config), config))
  );

  const readmeContext = await loadReadmeContext(repositoryPath, fileResults);
  const readmeResults = README_SECTION_CHECKS.map((check) =>
    evaluateReadmeSection(applyWeight(check, config), readmeContext, config)
  );

  const checks = [...fileResults, ...readmeResults];
  const activeChecks = checks.filter((result) => !result.excluded);
  const earnedPoints = activeChecks.reduce((sum, result) => sum + result.earned, 0);
  const maxPoints = activeChecks.reduce((sum, result) => sum + result.points, 0);
  const score = maxPoints === 0 ? 100 : Math.round((earnedPoints / maxPoints) * 100);
  const passed = score >= config.minScore;
  const resultWarnings = buildWarnings(checks, config);
  const resultRecommendations = unique(
    activeChecks.filter((result) => result.status === "fail").map((result) => result.recommendation)
  );

  if (maxPoints === 0) {
    resultWarnings.push("[config] All checks were excluded; score defaults to 100.");
  }

  return {
    score,
    passed,
    earnedPoints,
    maxPoints,
    files: fileResults,
    readmeSections: readmeResults,
    checks,
    warnings: unique(resultWarnings),
    recommendations: resultRecommendations,
    config
  };
}

async function evaluateFileCheck(
  repositoryPath: string,
  check: AuditCheckDefinition,
  config: AuditConfig
): Promise<CheckResult> {
  if (config.excludeChecks.includes(check.id)) {
    return toCheckResult(check, {
      status: "excluded",
      detail: "Excluded by configuration"
    });
  }

  const targetPath = path.join(repositoryPath, check.path ?? "");
  const inspection = await inspectPath(targetPath, check.expectedType ?? "file");

  if (!inspection.exists || !inspection.validType) {
    return toCheckResult(check, {
      status: "fail",
      detail: inspection.detail
    });
  }

  const validation = await validateFileContent(repositoryPath, targetPath, check, config);
  return toCheckResult(check, validation);
}

async function validateFileContent(
  repositoryPath: string,
  targetPath: string,
  check: AuditCheckDefinition,
  config: AuditConfig
): Promise<ValidationResult> {
  switch (check.id) {
    case "readme":
      return validateNonEmptyFile(targetPath, "Found non-empty README.md");
    case "license":
      return validateLicense(targetPath);
    case "contributing":
      return validateContributing(targetPath);
    case "code-of-conduct":
      return validateCodeOfConduct(targetPath);
    case "security":
      return validateSecurity(targetPath);
    case "funding":
      return validateFunding(targetPath);
    case "issue-template":
      return validateIssueTemplates(targetPath);
    case "pull-request-template":
      return validatePullRequestTemplate(targetPath);
    default:
      void repositoryPath;
      void config;
      return { status: "pass", detail: "Found" };
  }
}

async function inspectPath(targetPath: string, expectedType: ExpectedPathType): Promise<PathInspection> {
  try {
    const stat = await fs.stat(targetPath);
    const actualType = stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "file-or-directory";
    const validType = expectedType === "file-or-directory" || actualType === expectedType;

    return {
      exists: true,
      validType,
      actualType,
      detail: validType
        ? `Found ${actualType}`
        : `Invalid type: expected ${expectedType}, found ${actualType}`
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        exists: false,
        validType: false,
        detail: "Missing"
      };
    }

    throw error;
  }
}

async function validateNonEmptyFile(targetPath: string, successDetail: string): Promise<ValidationResult> {
  const content = await fs.readFile(targetPath, "utf8");

  if (content.trim().length === 0) {
    return { status: "fail", detail: "Empty file" };
  }

  return { status: "pass", detail: successDetail };
}

async function validateLicense(targetPath: string): Promise<ValidationResult> {
  const content = await fs.readFile(targetPath, "utf8");
  const normalizedContent = normalize(content);

  if (content.trim().length === 0) {
    return { status: "fail", detail: "Empty LICENSE file" };
  }

  if (content.trim().length < MIN_LICENSE_LENGTH) {
    return {
      status: "warning",
      detail: "LICENSE is present but very short; license type could not be confidently recognized"
    };
  }

  const license = detectLicense(normalizedContent);
  if (!license) {
    return {
      status: "warning",
      detail: "LICENSE is present but no common license was recognized"
    };
  }

  return { status: "pass", detail: `Recognized ${license} license` };
}

function detectLicense(normalizedContent: string): string | undefined {
  if (
    /\bmit license\b/.test(normalizedContent) ||
    /\bpermission is hereby granted\b/.test(normalizedContent)
  ) {
    return "MIT";
  }

  if (/\bapache license\b/.test(normalizedContent) || /\bapache-?2\.0\b/.test(normalizedContent)) {
    return "Apache-2.0";
  }

  if (/\bgnu general public license\b/.test(normalizedContent) || /\bgpl\b/.test(normalizedContent)) {
    return "GPL";
  }

  if (
    /\bbsd\b/.test(normalizedContent) ||
    /\bredistribution and use in source and binary forms\b/.test(normalizedContent)
  ) {
    return "BSD";
  }

  if (/\bisc license\b/.test(normalizedContent)) {
    return "ISC";
  }

  if (/\bmozilla public license\b/.test(normalizedContent) || /\bmpl-?2\.0\b/.test(normalizedContent)) {
    return "MPL";
  }

  return undefined;
}

async function validateContributing(targetPath: string): Promise<ValidationResult> {
  const content = await readRequiredContent(targetPath, "CONTRIBUTING.md");
  if (content.status === "fail") {
    return content;
  }

  const normalizedContent = normalize(content.detail);
  const usefulSignals = countMatches(normalizedContent, [
    /\b(setup|install|local setup|development|desarrollo)\b/,
    /\b(test|tests|testing|prueba|pruebas)\b/,
    /\b(build|compile|bundle|compilar)\b/,
    /\b(pull request|pr|merge request)\b/,
    /\b(development flow|workflow|flujo)\b/
  ]);

  if (usefulSignals < 2) {
    return {
      status: "fail",
      detail: "CONTRIBUTING.md lacks setup, test/build, PR, or development flow guidance"
    };
  }

  return { status: "pass", detail: "Found useful contributing guidance" };
}

async function validateCodeOfConduct(targetPath: string): Promise<ValidationResult> {
  const content = await readRequiredContent(targetPath, "CODE_OF_CONDUCT.md");
  if (content.status === "fail") {
    return content;
  }

  const normalizedContent = normalize(content.detail);
  const hasExpected = /\b(expected behavior|expected behaviour|comportamiento esperado)\b/.test(
    normalizedContent
  );
  const hasUnacceptable =
    /\b(unacceptable behavior|unacceptable behaviour|comportamiento inaceptable)\b/.test(normalizedContent);
  const hasEnforcement = /\b(enforcement|aplicacion|aplicación|cumplimiento)\b/.test(normalizedContent);

  if (!(hasEnforcement && (hasExpected || hasUnacceptable))) {
    return {
      status: "fail",
      detail: "CODE_OF_CONDUCT.md needs expected/unacceptable behavior and enforcement guidance"
    };
  }

  return { status: "pass", detail: "Found behavior and enforcement guidance" };
}

async function validateSecurity(targetPath: string): Promise<ValidationResult> {
  const content = await readRequiredContent(targetPath, "SECURITY.md");
  if (content.status === "fail") {
    return content;
  }

  const rawContent = content.detail;
  const normalizedContent = normalize(rawContent);
  const hasPlaceholder = PLACEHOLDER_PATTERN.test(rawContent);
  const hasPrivateChannel =
    EMAIL_PATTERN.test(rawContent) || PRIVATE_REPORTING_PATTERN.test(normalizedContent);

  if (hasPlaceholder) {
    return {
      status: "fail",
      detail: "Placeholder detected in SECURITY.md reporting instructions"
    };
  }

  if (!hasPrivateChannel) {
    return {
      status: "fail",
      detail: "SECURITY.md lacks a private reporting channel"
    };
  }

  return { status: "pass", detail: "Found private vulnerability reporting instructions" };
}

async function validateFunding(targetPath: string): Promise<ValidationResult> {
  const content = await readRequiredContent(targetPath, ".github/FUNDING.yml");
  if (content.status === "fail") {
    return content;
  }

  const rawContent = content.detail;
  const meaningfulLines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (meaningfulLines.length === 0 || PLACEHOLDER_PATTERN.test(rawContent)) {
    return {
      status: "fail",
      detail: "Placeholder detected in FUNDING.yml"
    };
  }

  return { status: "pass", detail: "Found funding configuration without placeholders" };
}

async function validateIssueTemplates(directoryPath: string): Promise<ValidationResult> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const templateFiles = entries
    .filter((entry) => entry.isFile() && /\.(?:ya?ml|md)$/i.test(entry.name))
    .map((entry) => path.join(directoryPath, entry.name));

  if (templateFiles.length === 0) {
    return {
      status: "fail",
      detail: "ISSUE_TEMPLATE directory has no .yml, .yaml, or .md templates"
    };
  }

  const templates = await Promise.all(
    templateFiles.map(async (filePath) => ({
      filePath,
      content: await fs.readFile(filePath, "utf8")
    }))
  );
  const usefulTemplates = templates.filter(isUsefulIssueTemplate);

  if (usefulTemplates.length === 0) {
    return {
      status: "fail",
      detail: "Issue templates exist but lack required name, description, body, or non-empty Markdown content"
    };
  }

  return { status: "pass", detail: `Found ${usefulTemplates.length} useful issue template(s)` };
}

function isUsefulIssueTemplate(template: IssueTemplateFile): boolean {
  if (template.content.trim().length === 0) {
    return false;
  }

  if (/\.md$/i.test(template.filePath)) {
    return template.content.trim().length >= 20;
  }

  return (
    /^name:\s*\S/im.test(template.content) &&
    /^description:\s*\S/im.test(template.content) &&
    /^body:\s*$/im.test(template.content)
  );
}

async function validatePullRequestTemplate(targetPath: string): Promise<ValidationResult> {
  const content = await readRequiredContent(targetPath, ".github/PULL_REQUEST_TEMPLATE.md");
  if (content.status === "fail") {
    return content;
  }

  const normalizedContent = normalize(content.detail);
  const hasChecklist = /-\s*\[[ x]\]/i.test(content.detail);
  const sectionSignals = countMatches(normalizedContent, [
    /\bsummary\b/,
    /\btests?\b/,
    /\bdocs?|documentation\b/,
    /\brisk\b/,
    /\bchecklist\b/
  ]);

  if (!hasChecklist && sectionSignals < 2) {
    return {
      status: "fail",
      detail: "Pull request template needs a checklist or sections for summary, tests, docs, or risk"
    };
  }

  return { status: "pass", detail: "Found useful pull request template" };
}

async function readRequiredContent(targetPath: string, label: string): Promise<ValidationResult> {
  const content = await fs.readFile(targetPath, "utf8");

  if (content.trim().length === 0) {
    return { status: "fail", detail: `Empty ${label}` };
  }

  return { status: "pass", detail: content };
}

interface ReadmeContext {
  exists: boolean;
  valid: boolean;
  content: string;
  strippedContent: string;
  headings: string[];
}

async function loadReadmeContext(repositoryPath: string, fileResults: CheckResult[]): Promise<ReadmeContext> {
  const readmeResult = fileResults.find((result) => result.id === "readme");
  const exists = readmeResult?.status !== "fail" && readmeResult?.status !== "excluded";

  if (!exists) {
    return {
      exists: false,
      valid: false,
      content: "",
      strippedContent: "",
      headings: []
    };
  }

  const content = await fs.readFile(path.join(repositoryPath, "README.md"), "utf8");
  const strippedContent = stripFencedCodeBlocks(content);

  return {
    exists: true,
    valid: content.trim().length > 0,
    content,
    strippedContent,
    headings: extractMarkdownHeadings(strippedContent)
  };
}

function evaluateReadmeSection(
  check: ReadmeSectionCheckDefinition,
  readmeContext: ReadmeContext,
  config: AuditConfig
): CheckResult {
  if (config.excludeChecks.includes(check.id)) {
    return toCheckResult(check, {
      status: "excluded",
      detail: "Excluded by configuration"
    });
  }

  if (!readmeContext.exists) {
    return toCheckResult(check, {
      status: "fail",
      detail: "README.md missing"
    });
  }

  if (!readmeContext.valid) {
    return toCheckResult(check, {
      status: "fail",
      detail: "README.md empty"
    });
  }

  const headingMatched = hasReadmeHeading(check, readmeContext.headings, config.readmeLanguage);
  const looseMatched =
    !config.strictMode &&
    (check.loosePatterns ?? []).some((pattern) => pattern.test(readmeContext.strippedContent));
  const passed = headingMatched || looseMatched;

  return toCheckResult(check, {
    status: passed ? "pass" : "fail",
    detail: passed
      ? headingMatched
        ? "Section heading detected"
        : "Section signal detected"
      : "Section missing"
  });
}

function hasReadmeHeading(
  check: ReadmeSectionCheckDefinition,
  headings: string[],
  readmeLanguage: AuditConfig["readmeLanguage"]
): boolean {
  const languages = readmeLanguage === "auto" ? (["en", "es"] as const) : ([readmeLanguage] as const);
  const expectedHeadings = languages.flatMap((language) => check.headings[language]).map(normalizeHeading);

  return headings.some((heading) =>
    expectedHeadings.some((expectedHeading) => new RegExp(`^${expectedHeading}$`).test(heading))
  );
}

function stripFencedCodeBlocks(content: string): string {
  const lines = content.split(/\r?\n/);
  const strippedLines: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }

    if (!inFence) {
      strippedLines.push(line);
    }
  }

  return strippedLines.join("\n");
}

function extractMarkdownHeadings(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1])
    .filter((heading): heading is string => Boolean(heading))
    .map(normalizeHeading);
}

function normalizeHeading(value: string): string {
  return normalize(value)
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s?]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toCheckResult(
  check: AuditCheckDefinition,
  validation: ValidationResult | { status: "excluded"; detail: string }
): CheckResult {
  const excluded = validation.status === "excluded";
  const passed = validation.status === "pass" || validation.status === "warning";

  return {
    id: check.id,
    category: check.category,
    label: check.label,
    points: excluded ? 0 : check.points,
    earned: passed ? check.points : 0,
    passed,
    status: validation.status,
    excluded,
    recommendation:
      "recommendation" in validation && validation.recommendation
        ? validation.recommendation
        : check.recommendation,
    detail: validation.detail
  };
}

function applyWeight<T extends AuditCheckDefinition>(check: T, config: AuditConfig): T {
  const customWeight = config.customWeights[check.id];

  if (customWeight === undefined) {
    return check;
  }

  return { ...check, points: customWeight };
}

function buildWarnings(checks: CheckResult[], config: AuditConfig): string[] {
  const checkWarnings = checks
    .filter((result) => result.status === "fail" || result.status === "warning")
    .map((result) => `[${result.id}] ${result.detail}`);
  const configWarnings = [
    ...config.unknownExcludedChecks.map((id) => `[config] Unknown exclude-checks id ignored: ${id}`),
    ...config.unknownCustomWeights.map((id) => `[config] Unknown custom-weights id ignored: ${id}`)
  ];

  return [...checkWarnings, ...configWarnings];
}

function countMatches(content: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(content)).length;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
