import type { DrillSet } from "./types";

export const SET_SUFFIX_PATTERN = /^(?:[A-Z]|\.[0-9]+)$/;

export function formatSetName(set: Pick<DrillSet, "number" | "suffix">): string {
  return `${set.number}${set.suffix ?? ""}`;
}

export function countPrimarySets(sets: readonly DrillSet[]): number {
  return sets.reduce((count, set) => count + (set.kind === "set" ? 1 : 0), 0);
}

export function compareSetIdentity(
  left: Pick<DrillSet, "number" | "suffix">,
  right: Pick<DrillSet, "number" | "suffix">,
): boolean {
  return left.number === right.number && (left.suffix ?? "") === (right.suffix ?? "");
}
