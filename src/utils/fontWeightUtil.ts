export const FONT_WEIGHT_MIN = 100;
export const FONT_WEIGHT_MAX = 900;
export const FONT_WEIGHT_STEP = 100;

export const normalizeFontWeight = (value: unknown): string | null => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.min(
    Math.max(parsed, FONT_WEIGHT_MIN),
    FONT_WEIGHT_MAX
  );
  return `${Math.round(clamped / FONT_WEIGHT_STEP) * FONT_WEIGHT_STEP}`;
};

export const resolveReaderFontWeight = (
  storedWeight: unknown
): string | null => {
  if (storedWeight === "yes") return "700";
  if (storedWeight === "no") return null;
  return normalizeFontWeight(storedWeight);
};
