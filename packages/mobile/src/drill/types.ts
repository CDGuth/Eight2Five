import type { FieldPoint } from "../field";

/**
 * A drill is deliberately performer-agnostic in this phase. Performer
 * identity, assignment, and per-performer positions belong to a later domain
 * layer and must not leak into these shared page records.
 */
export interface Drill {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** One performer-independent target page in a drill. */
export interface DrillPage {
  readonly id: string;
  readonly drillId: string;
  readonly ordinal: number;
  readonly label: string;
  readonly countsFromPrevious: number;
  readonly position: FieldPoint;
}
