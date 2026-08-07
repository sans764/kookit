export const PDF_SCALE_LIMITS = {
  min: 0.5,
  max: 3,
  default: 1,
} as const;

export const normalizePdfScaleMultiplier = (value: unknown): number => {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) ? parsed : PDF_SCALE_LIMITS.default;
  return Math.min(PDF_SCALE_LIMITS.max, Math.max(PDF_SCALE_LIMITS.min, safeValue));
};

export const applyPdfScaleMultiplier = (
  fitScale: number,
  multiplier: unknown
) => fitScale * normalizePdfScaleMultiplier(multiplier);
