import type {
  DrillGridPoint,
  MeasureRange,
  SetKind,
  FieldPresetId,
} from "@eight2five/drill-schema";

/**
 * App-local drill metadata. The portable drill document owns richer metadata;
 * SQLite keeps only the fields needed by the current mobile MVP.
 */
export interface Drill {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly fieldPreset: FieldPresetId;
}

/**
 * One ordered target set for the single-performer mobile MVP.
 *
 * `id` is an opaque SQLite row identifier. It intentionally differs from the
 * portable schema's zero-based set id: imports map portable set order to local
 * rows, while mobile editing can insert/reorder rows without exposing storage
 * identity in drill files.
 */
export interface DrillSet {
  readonly id: string;
  readonly drillId: string;
  readonly ordinal: number;
  readonly number: number;
  readonly suffix?: string;
  readonly kind: SetKind;
  readonly countsFromPrevious: number;
  readonly measureRange?: MeasureRange;
  readonly position: DrillGridPoint;
  readonly facingDegrees?: number;
}

/** @deprecated Use DrillSet. Kept temporarily for source compatibility. */
export type DrillPage = DrillSet;
