export const DEFAULT_MIN_SCORE = 70;

export function parseMinScore(value: string | undefined): number {
  const normalizedValue = value?.trim() || String(DEFAULT_MIN_SCORE);
  const score = Number(normalizedValue);

  if (!Number.isFinite(score)) {
    throw new Error(`min-score must be a number from 0 to 100. Received: ${normalizedValue}`);
  }

  if (score < 0 || score > 100) {
    throw new Error(`min-score must be between 0 and 100. Received: ${normalizedValue}`);
  }

  return score;
}

