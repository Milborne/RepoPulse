import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_SCORE, parseMinScore } from "../src/config";

describe("parseMinScore", () => {
  it("uses the default score when the input is empty", () => {
    expect(parseMinScore("")).toBe(DEFAULT_MIN_SCORE);
    expect(parseMinScore(undefined)).toBe(DEFAULT_MIN_SCORE);
  });

  it("accepts numeric scores from 0 to 100", () => {
    expect(parseMinScore("0")).toBe(0);
    expect(parseMinScore("85")).toBe(85);
    expect(parseMinScore("100")).toBe(100);
  });

  it("rejects invalid scores", () => {
    expect(() => parseMinScore("high")).toThrow("min-score must be a number");
    expect(() => parseMinScore("-1")).toThrow("min-score must be between 0 and 100");
    expect(() => parseMinScore("101")).toThrow("min-score must be between 0 and 100");
  });
});

