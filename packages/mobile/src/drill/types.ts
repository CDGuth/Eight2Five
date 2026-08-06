import type {
  DrillGridPoint,
  DrillDocument,
  DrillMetadata,
  MeasureRange,
  SetKind,
  FieldPresetId,
} from "@eight2five/drill-schema";

/**
 * The metadata columns stored with a drill are a small, query-friendly summary
 * of the portable document metadata. The complete metadata (and the rest of
 * the document) is available through DrillRepository.getDrillDocument.
 */
export interface Drill {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly fieldPreset: FieldPresetId;
  readonly metadata?: DrillMetadata;
  readonly selectedPerformerEntityId?: number;
}

/**
 * One ordered target set for the selected performer projection.
 *
 * `id` is an opaque SQLite row identifier. It intentionally differs from the
 * portable schema's zero-based set id: imports map portable set order to local
 * rows, while mobile editing can insert/reorder rows without exposing storage
 * identity in drill files. Imported rows retain the portable source set id so
 * the projection can be rebuilt without changing the authoritative document.
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
  readonly sourceSetId?: number;
}

/** A validated portable document retained for an imported drill. */
export type SourceDrillDocument = DrillDocument;

/** @deprecated Use DrillSet. Kept temporarily for source compatibility. */
export type DrillPage = DrillSet;
