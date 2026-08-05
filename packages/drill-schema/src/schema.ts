import { z } from "zod";

import { SET_SUFFIX_PATTERN } from "./sets";
import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  FIELD_PRESET_IDS,
  PROP_SIZE_UNITS,
  type DrillDocument,
} from "./types";

const safeNonNegativeInteger = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const finiteNumber = z.number().finite();
const positiveFiniteNumber = finiteNumber.gt(0);
const nonEmptyText = z.string().trim().min(1);
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const symbol = z.string().trim().min(1).max(16);
const lucideIcon = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const measureRangeSchema = z
  .object({
    start: safeNonNegativeInteger,
    end: safeNonNegativeInteger,
  })
  .strict()
  .superRefine((range, context) => {
    if (range.end < range.start) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "Measure range end must be greater than or equal to start.",
      });
    }
  });

export const drillSetSchema = z
  .object({
    id: safeNonNegativeInteger,
    number: safeNonNegativeInteger,
    suffix: z.string().regex(SET_SUFFIX_PATTERN).optional(),
    kind: z.enum(["set", "subset"]),
    countsFromPrevious: safeNonNegativeInteger,
    measureRange: measureRangeSchema.optional(),
  })
  .strict()
  .superRefine((set, context) => {
    if (set.kind === "set" && set.suffix !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suffix"],
        message: "Primary sets cannot have a suffix.",
      });
    }
    if (set.kind === "subset" && set.suffix === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suffix"],
        message: "Subsets must have a letter or decimal suffix.",
      });
    }
  });

export const entityIconSchema = z.enum([
  "dot",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon",
  "cross",
]);

export const entityAppearanceSchema = z
  .object({
    icon: entityIconSchema.optional(),
    color: hexColor.optional(),
    labelVisible: z.boolean().optional(),
  })
  .strict();

export const propSizeSchema = z
  .object({
    length: positiveFiniteNumber,
    width: positiveFiniteNumber,
    unit: z.enum(PROP_SIZE_UNITS),
  })
  .strict();

export const drillEntitySchema = z
  .object({
    id: safeNonNegativeInteger,
    type: z.enum(["performer", "prop"]),
    symbol,
    label: nonEmptyText,
    name: nonEmptyText.optional(),
    section: nonEmptyText.optional(),
    instrument: nonEmptyText.optional(),
    size: propSizeSchema.optional(),
    appearance: entityAppearanceSchema.optional(),
  })
  .strict()
  .superRefine((entity, context) => {
    if (entity.type !== "prop") {
      if (entity.size !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["size"],
          message: "Only props can define a size.",
        });
      }
      return;
    }
    if (entity.section !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["section"],
        message: "Props cannot define a section.",
      });
    }
    if (entity.instrument !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["instrument"],
        message: "Props cannot define an instrument.",
      });
    }
  });

export const entityRuleValuesSchema = z
  .object({
    type: z.enum(["performer", "prop"]).optional(),
    name: nonEmptyText.optional(),
    section: nonEmptyText.optional(),
    instrument: nonEmptyText.optional(),
    size: propSizeSchema.optional(),
    appearance: entityAppearanceSchema.optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.type !== "prop") {
      if (rule.size !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["size"],
          message: "Only prop rules can define a size.",
        });
      }
      return;
    }
    if (rule.section !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["section"],
        message: "Prop rules cannot define a section.",
      });
    }
    if (rule.instrument !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["instrument"],
        message: "Prop rules cannot define an instrument.",
      });
    }
  });

const ruleMapSchema = z.record(entityRuleValuesSchema);

export const entityRulesSchema = z
  .object({
    bySymbol: ruleMapSchema.optional(),
    byLabel: ruleMapSchema.optional(),
    byId: ruleMapSchema.optional(),
  })
  .strict()
  .superRefine((rules, context) => {
    for (const key of Object.keys(rules.bySymbol ?? {})) {
      if (key.trim().length === 0 || key.length > 16) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bySymbol", key],
          message: "Symbol rule keys must be 1-16 non-whitespace characters.",
        });
      }
    }
    for (const key of Object.keys(rules.byId ?? {})) {
      const parsed = Number(key);
      if (
        !/^(?:0|[1-9][0-9]*)$/.test(key) ||
        !Number.isSafeInteger(parsed) ||
        parsed < 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["byId", key],
          message: "ID rule keys must be non-negative safe integer strings.",
        });
      }
    }
  });

export const drillGridPointSchema = z
  .object({
    xSteps: finiteNumber,
    ySteps: finiteNumber,
  })
  .strict();

export const drillPositionSchema = z
  .object({
    entityId: safeNonNegativeInteger,
    setId: safeNonNegativeInteger,
    xSteps: finiteNumber,
    ySteps: finiteNumber,
    facingDegrees: finiteNumber.min(0).lt(360).optional(),
  })
  .strict();

const pathBase = {
  entityId: safeNonNegativeInteger,
  fromSetId: safeNonNegativeInteger,
  toSetId: safeNonNegativeInteger,
};

export const drillPathSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...pathBase,
      kind: z.literal("straight"),
    })
    .strict(),
  z
    .object({
      ...pathBase,
      kind: z.literal("polyline"),
      waypoints: z.array(drillGridPointSchema).min(1),
    })
    .strict(),
  z
    .object({
      ...pathBase,
      kind: z.literal("bezier"),
      controlPoints: z.tuple([drillGridPointSchema, drillGridPointSchema]),
    })
    .strict(),
]);

const physicalBoundsSchema = z
  .object({
    minXMeters: finiteNumber,
    maxXMeters: finiteNumber,
    minYMeters: finiteNumber,
    maxYMeters: finiteNumber,
  })
  .strict()
  .superRefine((bounds, context) => {
    if (bounds.maxXMeters <= bounds.minXMeters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxXMeters"],
        message: "Physical X bounds must have positive width.",
      });
    }
    if (bounds.maxYMeters <= bounds.minYMeters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxYMeters"],
        message: "Physical Y bounds must have positive height.",
      });
    }
  });

const marchingBoundsSchema = z
  .object({
    minXSteps: finiteNumber,
    maxXSteps: finiteNumber,
    minYSteps: finiteNumber,
    maxYSteps: finiteNumber,
  })
  .strict()
  .superRefine((bounds, context) => {
    if (bounds.maxXSteps <= bounds.minXSteps) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxXSteps"],
        message: "Marching X bounds must have positive width.",
      });
    }
    if (bounds.maxYSteps <= bounds.minYSteps) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxYSteps"],
        message: "Marching Y bounds must have positive height.",
      });
    }
  });

const physicalReferenceLineSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    axis: z.enum(["x", "y"]),
    coordinateMeters: finiteNumber,
  })
  .strict();

const marchingReferenceLineSchema = z
  .object({
    id: nonEmptyText,
    name: nonEmptyText,
    axis: z.enum(["x", "y"]),
    coordinateSteps: finiteNumber,
  })
  .strict();

const physicalGeometrySchema = z
  .object({
    bounds: physicalBoundsSchema,
    referenceLines: z.array(physicalReferenceLineSchema).min(4),
  })
  .strict();

const marchingGridSchema = z
  .object({
    bounds: marchingBoundsSchema,
    referenceLines: z.array(marchingReferenceLineSchema).min(4),
  })
  .strict();

const presetFieldSchema = z
  .object({
    type: z.literal("preset"),
    preset: z.enum(FIELD_PRESET_IDS),
  })
  .strict();

const customFieldSchema = z
  .object({
    type: z.literal("custom"),
    name: nonEmptyText,
    physicalGeometry: physicalGeometrySchema,
    marchingGrid: marchingGridSchema,
  })
  .strict()
  .superRefine((field, context) => {
    const physical = new Map<string, { axis: "x" | "y"; coordinate: number }>();
    for (const [index, line] of field.physicalGeometry.referenceLines.entries()) {
      if (physical.has(line.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["physicalGeometry", "referenceLines", index, "id"],
          message: `Duplicate physical reference id ${line.id}.`,
        });
      }
      physical.set(line.id, { axis: line.axis, coordinate: line.coordinateMeters });
    }

    const matchedByAxis = { x: 0, y: 0 };
    const gridCoordinates = { x: new Set<number>(), y: new Set<number>() };
    const physicalCoordinates = { x: new Set<number>(), y: new Set<number>() };
    const seenGridIds = new Set<string>();
    for (const [index, line] of field.marchingGrid.referenceLines.entries()) {
      if (seenGridIds.has(line.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marchingGrid", "referenceLines", index, "id"],
          message: `Duplicate marching reference id ${line.id}.`,
        });
      }
      seenGridIds.add(line.id);
      const physicalLine = physical.get(line.id);
      if (!physicalLine) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marchingGrid", "referenceLines", index, "id"],
          message: `No matching physical reference for ${line.id}.`,
        });
        continue;
      }
      if (physicalLine.axis !== line.axis) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marchingGrid", "referenceLines", index, "axis"],
          message: `Reference ${line.id} must use the same axis in both coordinate spaces.`,
        });
        continue;
      }
      matchedByAxis[line.axis] += 1;
      if (gridCoordinates[line.axis].has(line.coordinateSteps)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marchingGrid", "referenceLines", index, "coordinateSteps"],
          message: `Matched ${line.axis.toUpperCase()} grid references must use unique coordinates.`,
        });
      }
      if (physicalCoordinates[line.axis].has(physicalLine.coordinate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["physicalGeometry", "referenceLines"],
          message: `Matched ${line.axis.toUpperCase()} physical references must use unique coordinates.`,
        });
      }
      gridCoordinates[line.axis].add(line.coordinateSteps);
      physicalCoordinates[line.axis].add(physicalLine.coordinate);
    }

    for (const axis of ["x", "y"] as const) {
      if (matchedByAxis[axis] < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marchingGrid", "referenceLines"],
          message: `Custom fields require at least two matched ${axis.toUpperCase()} references.`,
        });
      }
    }
  });

export const fieldDefinitionSchema = z.union([
  presetFieldSchema,
  customFieldSchema,
]);

const sourceReferenceTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set"), setId: safeNonNegativeInteger }).strict(),
  z
    .object({ type: z.literal("entity"), entityId: safeNonNegativeInteger })
    .strict(),
  z
    .object({
      type: z.literal("position"),
      entityId: safeNonNegativeInteger,
      setId: safeNonNegativeInteger,
    })
    .strict(),
]);

const sourceReferenceSchema = z
  .object({
    target: sourceReferenceTargetSchema,
    page: z.number().int().positive().optional(),
    rawText: z.string().optional(),
  })
  .strict();

const provenanceSchema = z
  .object({
    source: z
      .object({
        kind: nonEmptyText,
        fileName: nonEmptyText.optional(),
      })
      .strict()
      .optional(),
    importer: z
      .object({
        name: nonEmptyText,
        version: nonEmptyText,
      })
      .strict()
      .optional(),
    importedAt: z.string().datetime().optional(),
    references: z.array(sourceReferenceSchema).optional(),
  })
  .strict();

const metadataSchema = z
  .object({
    title: nonEmptyText,
    createdAt: z.string().datetime(),
    drillWriter: nonEmptyText.optional(),
    ensemble: nonEmptyText.optional(),
    description: z.string().optional(),
    lucideIcon: lucideIcon.optional(),
  })
  .strict();

export const drillDocumentSchema: z.ZodType<DrillDocument> = z
  .object({
    schema: z.literal(DRILL_SCHEMA_URL),
    schemaVersion: z.literal(DRILL_SCHEMA_VERSION),
    metadata: metadataSchema,
    field: fieldDefinitionSchema,
    entityRules: entityRulesSchema.optional(),
    entities: z.array(drillEntitySchema),
    sets: z.array(drillSetSchema).min(1),
    positions: z.array(drillPositionSchema),
    paths: z.array(drillPathSchema).optional(),
    provenance: provenanceSchema.optional(),
    extensions: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((document, context) => {
    const entityIds = new Set<number>();
    const entityLabels = new Set<string>();
    for (const [index, entity] of document.entities.entries()) {
      if (entityIds.has(entity.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entities", index, "id"],
          message: `Duplicate entity id ${entity.id}.`,
        });
      }
      if (entityLabels.has(entity.label)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entities", index, "label"],
          message: `Duplicate entity label ${entity.label}.`,
        });
      }
      entityIds.add(entity.id);
      entityLabels.add(entity.label);
    }

    const primaryNumbers = new Set<number>();
    const setIdentities = new Set<string>();
    for (const [index, set] of document.sets.entries()) {
      if (set.id !== index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sets", index, "id"],
          message: `Set id must equal its zero-based array index (${index}).`,
        });
      }
      if (index === 0 && set.countsFromPrevious !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sets", index, "countsFromPrevious"],
          message: "The first set must have zero counts from previous.",
        });
      }
      const identity = `${set.number}|${set.suffix ?? ""}`;
      if (setIdentities.has(identity)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sets", index],
          message: `Duplicate display set identity ${set.number}${set.suffix ?? ""}.`,
        });
      }
      setIdentities.add(identity);
      if (set.kind === "set") {
        if (primaryNumbers.has(set.number)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sets", index, "number"],
            message: `Primary set number ${set.number} may appear only once.`,
          });
        }
        primaryNumbers.add(set.number);
      }
    }
    for (const [index, set] of document.sets.entries()) {
      if (set.kind === "subset" && !primaryNumbers.has(set.number)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sets", index, "number"],
          message: `Subset ${set.number}${set.suffix ?? ""} requires a primary set with number ${set.number}.`,
        });
      }
    }

    const positionKeys = new Set<string>();
    for (const [index, position] of document.positions.entries()) {
      if (!entityIds.has(position.entityId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["positions", index, "entityId"],
          message: `Unknown entity id ${position.entityId}.`,
        });
      }
      if (position.setId >= document.sets.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["positions", index, "setId"],
          message: `Unknown set id ${position.setId}.`,
        });
      }
      const key = `${position.entityId}|${position.setId}`;
      if (positionKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["positions", index],
          message: `Duplicate position for entity ${position.entityId} at set ${position.setId}.`,
        });
      }
      positionKeys.add(key);
    }

    const pathKeys = new Set<string>();
    for (const [index, path] of (document.paths ?? []).entries()) {
      if (!entityIds.has(path.entityId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paths", index, "entityId"],
          message: `Unknown entity id ${path.entityId}.`,
        });
      }
      if (
        path.fromSetId >= document.sets.length ||
        path.toSetId >= document.sets.length
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paths", index],
          message: "Path set references must exist in this drill.",
        });
      }
      if (path.toSetId !== path.fromSetId + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paths", index, "toSetId"],
          message: "Paths may only connect consecutive set entries.",
        });
      }
      if (
        !positionKeys.has(`${path.entityId}|${path.fromSetId}`) ||
        !positionKeys.has(`${path.entityId}|${path.toSetId}`)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paths", index],
          message: "A path requires endpoint positions at both referenced sets.",
        });
      }
      const key = `${path.entityId}|${path.fromSetId}|${path.toSetId}`;
      if (pathKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paths", index],
          message: "Only one explicit path is allowed per entity transition.",
        });
      }
      pathKeys.add(key);
    }

    for (const [index, reference] of (
      document.provenance?.references ?? []
    ).entries()) {
      const target = reference.target;
      if ("entityId" in target && !entityIds.has(target.entityId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "references", index, "target", "entityId"],
          message: `Unknown provenance entity id ${target.entityId}.`,
        });
      }
      if ("setId" in target && target.setId >= document.sets.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "references", index, "target", "setId"],
          message: `Unknown provenance set id ${target.setId}.`,
        });
      }
    }
  });

export function parseDrillDocument(value: unknown): DrillDocument {
  return drillDocumentSchema.parse(value);
}

export function safeParseDrillDocument(value: unknown) {
  return drillDocumentSchema.safeParse(value);
}

export function parseDrillDocumentJson(json: string): DrillDocument {
  return parseDrillDocument(JSON.parse(json) as unknown);
}

export function serializeDrillDocument(document: DrillDocument): string {
  const validated = parseDrillDocument(document);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
