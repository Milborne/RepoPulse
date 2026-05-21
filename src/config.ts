import { ALL_CHECK_IDS } from "./checks";

export const DEFAULT_MIN_SCORE = 70;

export type OutputFormat = "text" | "markdown" | "json";
export type ReadmeLanguage = "auto" | "en" | "es";

export interface AuditConfig {
  minScore: number;
  strictMode: boolean;
  failOnMissing: boolean;
  format: OutputFormat;
  excludeChecks: string[];
  readmeLanguage: ReadmeLanguage;
  customWeights: Record<string, number>;
  jobSummary: boolean;
  unknownExcludedChecks: string[];
  unknownCustomWeights: string[];
}

export interface RawActionInputs {
  minScore?: string;
  strictMode?: string;
  failOnMissing?: string;
  format?: string;
  excludeChecks?: string;
  readmeLanguage?: string;
  customWeights?: string;
  jobSummary?: string;
}

const DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const VALID_FORMATS = ["text", "markdown", "json"] as const;
const VALID_README_LANGUAGES = ["auto", "en", "es"] as const;

export function parseActionConfig(inputs: RawActionInputs): AuditConfig {
  const parsedExcludeChecks = parseCsvList(inputs.excludeChecks);
  const unknownExcludedChecks = parsedExcludeChecks.filter((id) => !ALL_CHECK_IDS.includes(id));
  const knownExcludedChecks = parsedExcludeChecks.filter((id) => ALL_CHECK_IDS.includes(id));
  const parsedCustomWeights = parseCustomWeights(inputs.customWeights);

  return {
    minScore: parseMinScore(inputs.minScore),
    strictMode: parseBoolean(inputs.strictMode, false, "strict-mode"),
    failOnMissing: parseBoolean(inputs.failOnMissing, true, "fail-on-missing"),
    format: parseEnum(inputs.format, VALID_FORMATS, "text", "format"),
    excludeChecks: unique(knownExcludedChecks),
    readmeLanguage: parseEnum(inputs.readmeLanguage, VALID_README_LANGUAGES, "auto", "readme-language"),
    customWeights: parsedCustomWeights.weights,
    jobSummary: parseBoolean(inputs.jobSummary, true, "job-summary"),
    unknownExcludedChecks: unique(unknownExcludedChecks),
    unknownCustomWeights: parsedCustomWeights.unknownIds
  };
}

export function parseMinScore(value: string | undefined): number {
  const normalizedValue = value?.trim() || String(DEFAULT_MIN_SCORE);

  if (!DECIMAL_PATTERN.test(normalizedValue)) {
    throw new Error(`min-score must be a decimal number from 0 to 100. Received: ${normalizedValue}`);
  }

  const score = Number(normalizedValue);

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`min-score must be between 0 and 100. Received: ${normalizedValue}`);
  }

  return score;
}

function parseBoolean(value: string | undefined, defaultValue: boolean, inputName: string): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (["true", "1", "yes", "y", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`${inputName} must be true or false. Received: ${value}`);
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowedValues: T,
  defaultValue: T[number],
  inputName: string
): T[number] {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (allowedValues.includes(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`${inputName} must be one of: ${allowedValues.join(", ")}. Received: ${value}`);
}

function parseCsvList(value: string | undefined): string[] {
  return unique(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseCustomWeights(value: string | undefined): {
  weights: Record<string, number>;
  unknownIds: string[];
} {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return { weights: {}, unknownIds: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedValue);
  } catch {
    throw new Error('custom-weights must be valid JSON, for example: {"funding": 0}');
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("custom-weights must be a JSON object keyed by check id.");
  }

  const weights: Record<string, number> = {};
  const unknownIds: string[] = [];

  for (const [id, rawWeight] of Object.entries(parsed)) {
    if (!ALL_CHECK_IDS.includes(id)) {
      unknownIds.push(id);
      continue;
    }

    if (typeof rawWeight !== "number" || !Number.isFinite(rawWeight) || rawWeight < 0) {
      throw new Error(`custom-weights.${id} must be a non-negative finite number.`);
    }

    weights[id] = rawWeight;
  }

  return { weights, unknownIds: unique(unknownIds) };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
