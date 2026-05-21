import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_SCORE, parseActionConfig, parseMinScore } from "../src/config";

describe("parseMinScore", () => {
  it("uses the default score when the input is empty", () => {
    expect(parseMinScore("")).toBe(DEFAULT_MIN_SCORE);
    expect(parseMinScore("   ")).toBe(DEFAULT_MIN_SCORE);
    expect(parseMinScore(undefined)).toBe(DEFAULT_MIN_SCORE);
  });

  it("accepts decimal scores from 0 to 100", () => {
    expect(parseMinScore("0")).toBe(0);
    expect(parseMinScore("85")).toBe(85);
    expect(parseMinScore("99.5")).toBe(99.5);
    expect(parseMinScore("100")).toBe(100);
  });

  it("rejects unusual or out-of-range numeric formats", () => {
    expect(() => parseMinScore("high")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("NaN")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("Infinity")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("1e2")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("0x10")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("-1")).toThrow("min-score must be a decimal number");
    expect(() => parseMinScore("101")).toThrow("min-score must be between 0 and 100");
  });
});

describe("parseActionConfig", () => {
  it("keeps defaults compatible with the original action behavior", () => {
    const config = parseActionConfig({});

    expect(config.minScore).toBe(70);
    expect(config.strictMode).toBe(false);
    expect(config.failOnMissing).toBe(true);
    expect(config.format).toBe("text");
    expect(config.excludeChecks).toEqual([]);
    expect(config.readmeLanguage).toBe("auto");
    expect(config.customWeights).toEqual({});
    expect(config.jobSummary).toBe(true);
  });

  it("parses supported inputs", () => {
    const config = parseActionConfig({
      minScore: "82.5",
      strictMode: "true",
      failOnMissing: "false",
      format: "json",
      excludeChecks: "funding, code-of-conduct, unknown",
      readmeLanguage: "es",
      customWeights: '{"funding":0,"license":12,"unknown":1}',
      jobSummary: "false"
    });

    expect(config.minScore).toBe(82.5);
    expect(config.strictMode).toBe(true);
    expect(config.failOnMissing).toBe(false);
    expect(config.format).toBe("json");
    expect(config.excludeChecks).toEqual(["funding", "code-of-conduct"]);
    expect(config.unknownExcludedChecks).toEqual(["unknown"]);
    expect(config.readmeLanguage).toBe("es");
    expect(config.customWeights).toEqual({ funding: 0, license: 12 });
    expect(config.unknownCustomWeights).toEqual(["unknown"]);
    expect(config.jobSummary).toBe(false);
  });

  it("rejects invalid config values", () => {
    expect(() => parseActionConfig({ strictMode: "sometimes" })).toThrow("strict-mode must be true or false");
    expect(() => parseActionConfig({ format: "xml" })).toThrow("format must be one of");
    expect(() => parseActionConfig({ readmeLanguage: "fr" })).toThrow("readme-language must be one of");
    expect(() => parseActionConfig({ customWeights: "[]" })).toThrow("custom-weights must be a JSON object");
    expect(() => parseActionConfig({ customWeights: '{"funding":-1}' })).toThrow(
      "custom-weights.funding must be a non-negative finite number"
    );
  });
});
