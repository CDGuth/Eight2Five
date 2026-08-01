import { MAX_COMFORTABLE_ANCHOR_RANGE_METERS } from "@eight2five/mobile/settings";
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
  if (value > MAX_COMFORTABLE_ANCHOR_RANGE_METERS) {
    return {
      error: `Range must not exceed ${MAX_COMFORTABLE_ANCHOR_RANGE_METERS} meters.`,
    };
  }
  return { value };
}
