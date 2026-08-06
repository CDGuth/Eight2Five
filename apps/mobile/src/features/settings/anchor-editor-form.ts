import type { FieldPresetId } from "@eight2five/drill-schema";
import type { CoordinateRoundingSteps } from "@eight2five/mobile/settings";
import {
  ANCHOR_POSITION_REFERENCE_LABELS,
  ANCHOR_POSITION_REFERENCES,
  anchorFieldPositionFromMarchingCoordinate,
  anchorFieldPositionToStandard,
  anchorPositionUnitsToMeters,
  convertAnchorPositionUnits,
  formatMarchingCoordinate,
  getAnchorPositionReferencePoint,
  parseAnchorPositionDraft,
  type AnchorFieldPosition,
  type AnchorPositionReference,
  type AnchorPositionUnit,
  type StandardAnchorPositionDraft,
} from "@eight2five/mobile/field";

import {
  coordinateDraftFromFieldPoint,
  createDefaultPageDraft,
  validatePageDraft,
  type MarchingCoordinateDraft,
} from "../drill/page-form";

export type AnchorEditorMode = "marching" | "standard";
export type MarchingHeightUnit = "meters" | "feet";
const DEFAULT_ANCHOR_HEIGHT_METERS = 2;

export interface MarchingAnchorDraft {
  readonly coordinate: MarchingCoordinateDraft;
  readonly height: string;
  readonly heightUnit: MarchingHeightUnit;
}

export interface AnchorDraftValidation {
  readonly errors: Readonly<Record<string, string>>;
  readonly position?: AnchorFieldPosition;
}

export const ANCHOR_REFERENCE_CHOICES = ANCHOR_POSITION_REFERENCES.map(
  (value) => ({ label: ANCHOR_POSITION_REFERENCE_LABELS[value], value }),
);

export const ANCHOR_UNIT_CHOICES: readonly {
  readonly label: string;
  readonly value: AnchorPositionUnit;
}[] = [
  { label: "Meters", value: "meters" },
  { label: "Yards", value: "yards" },
  { label: "Feet", value: "feet" },
];

export function createAnchorEditorDrafts(
  position?: AnchorFieldPosition,
  fieldPreset: FieldPresetId = "football-nfhs",
): {
  readonly marching: MarchingAnchorDraft;
  readonly standard: StandardAnchorPositionDraft;
} {
  const center = getAnchorPositionReferencePoint("center-field", fieldPreset);
  const initial = position ?? {
    ...center,
    zMeters: DEFAULT_ANCHOR_HEIGHT_METERS,
  };
  const coordinate = position
    ? coordinateDraftFromFieldPoint(position, fieldPreset)
    : createDefaultPageDraft({ ordinal: 0, suggestedNumber: 0 });
  const standard = anchorFieldPositionToStandard(
    initial,
    "center-field",
    "meters",
    fieldPreset,
  );
  return {
    marching: {
      coordinate,
      height: String(initial.zMeters),
      heightUnit: "meters",
    },
    standard: {
      reference: standard.reference,
      unit: standard.unit,
      sideToSideOffset: formatDraftNumber(standard.sideToSideOffset),
      frontToBackOffset: formatDraftNumber(standard.frontToBackOffset),
      height: formatDraftNumber(standard.height),
    },
  };
}

export function validateMarchingAnchorDraft(
  draft: MarchingAnchorDraft,
  fieldPreset: FieldPresetId = "football-nfhs",
): AnchorDraftValidation {
  const coordinate = validatePageDraft(draft.coordinate, fieldPreset);
  const errors: Record<string, string> = { ...coordinate.errors };
  const height = Number(draft.height);
  if (!draft.height.trim() || !Number.isFinite(height)) {
    errors.height = "Enter a finite height.";
  } else if (height < 0) {
    errors.height = "Height cannot be negative.";
  }
  if (!coordinate.value || Object.keys(errors).length > 0) return { errors };
  try {
    return {
      errors,
      position: anchorFieldPositionFromMarchingCoordinate(
        coordinate.value.coordinate,
        anchorPositionUnitsToMeters(height, draft.heightUnit),
        fieldPreset,
      ),
    };
  } catch (cause) {
    return {
      errors: {
        ...errors,
        position: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
}

export function convertMarchingHeightUnit(
  draft: MarchingAnchorDraft,
  heightUnit: MarchingHeightUnit,
): MarchingAnchorDraft {
  if (heightUnit === draft.heightUnit) return draft;
  const value = Number(draft.height);
  return {
    ...draft,
    heightUnit,
    height:
      draft.height.trim() && Number.isFinite(value)
        ? formatDraftNumber(
            convertAnchorPositionUnits(value, draft.heightUnit, heightUnit),
          )
        : draft.height,
  };
}

export function validateStandardAnchorDraft(
  draft: StandardAnchorPositionDraft,
  fieldPreset: FieldPresetId = "football-nfhs",
): AnchorDraftValidation {
  const result = parseAnchorPositionDraft(draft, fieldPreset);
  return { errors: result.errors, position: result.value };
}

export function formatAnchorCanonicalPreview(
  position: AnchorFieldPosition | undefined,
  fieldPreset: FieldPresetId = "football-nfhs",
  coordinateRoundingSteps: CoordinateRoundingSteps = 0.25,
): { readonly marching: string; readonly meters: string } | undefined {
  if (!position) return undefined;
  return {
    marching: formatMarchingCoordinate(
      position,
      fieldPreset,
      coordinateRoundingSteps,
    ),
    meters: `X ${position.xMeters.toFixed(3)} m · Y ${position.yMeters.toFixed(3)} m · Z ${position.zMeters.toFixed(3)} m`,
  };
}

export function standardDraftFromPosition(
  position: AnchorFieldPosition,
  reference: AnchorPositionReference,
  unit: AnchorPositionUnit,
  fieldPreset: FieldPresetId = "football-nfhs",
): StandardAnchorPositionDraft {
  const standard = anchorFieldPositionToStandard(
    position,
    reference,
    unit,
    fieldPreset,
  );
  return {
    reference,
    unit,
    sideToSideOffset: formatDraftNumber(standard.sideToSideOffset),
    frontToBackOffset: formatDraftNumber(standard.frontToBackOffset),
    height: formatDraftNumber(standard.height),
  };
}

function formatDraftNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
