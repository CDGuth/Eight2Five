export interface ComfortableAnchorRangeResult {
  readonly value?: number;
  readonly error?: string;
}

export function parseComfortableAnchorRange(
  input: string,
): ComfortableAnchorRangeResult {
  if (!input.trim()) return { error: "Enter a comfortable range in meters." };
  const value = Number(input);
  if (!Number.isFinite(value)) return { error: "Range must be finite." };
  if (value <= 0) return { error: "Range must be greater than 0 meters." };
  if (value > 200) return { error: "Range must not exceed 200 meters." };
  return { value };
}
