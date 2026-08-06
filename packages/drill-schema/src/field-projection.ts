import { getFieldPreset } from "./field-presets";
import type {
  CustomFieldDefinition,
  DrillGridPoint,
  FieldDefinition,
  MarchingReferenceLine,
  PhysicalFieldPoint,
  PhysicalReferenceLine,
  ResolvedFieldDefinition,
} from "./types";

interface AxisReferencePair {
  readonly id: string;
  readonly grid: number;
  readonly physical: number;
}

export function resolveFieldDefinition(
  field: FieldDefinition,
): ResolvedFieldDefinition {
  if (field.type === "preset") return getFieldPreset(field.preset);
  return resolveCustomField(field);
}

function resolveCustomField(field: CustomFieldDefinition): ResolvedFieldDefinition {
  return {
    id: "custom",
    name: field.name,
    physicalGeometry: field.physicalGeometry,
    marchingGrid: field.marchingGrid,
    markings: field.markings,
  };
}

export function drillGridToPhysicalPoint(
  point: DrillGridPoint,
  field: FieldDefinition | ResolvedFieldDefinition,
): PhysicalFieldPoint {
  const resolved = isResolvedField(field) ? field : resolveFieldDefinition(field);
  return {
    xMeters: projectAxis(
      point.xSteps,
      pairReferences(resolved, "x"),
      "grid",
      "physical",
    ),
    yMeters: projectAxis(
      point.ySteps,
      pairReferences(resolved, "y"),
      "grid",
      "physical",
    ),
  };
}

export function physicalPointToDrillGrid(
  point: PhysicalFieldPoint,
  field: FieldDefinition | ResolvedFieldDefinition,
): DrillGridPoint {
  const resolved = isResolvedField(field) ? field : resolveFieldDefinition(field);
  return {
    xSteps: projectAxis(
      point.xMeters,
      pairReferences(resolved, "x"),
      "physical",
      "grid",
    ),
    ySteps: projectAxis(
      point.yMeters,
      pairReferences(resolved, "y"),
      "physical",
      "grid",
    ),
  };
}

function isResolvedField(
  field: FieldDefinition | ResolvedFieldDefinition,
): field is ResolvedFieldDefinition {
  return "physicalGeometry" in field && "marchingGrid" in field;
}

function pairReferences(
  field: ResolvedFieldDefinition,
  axis: "x" | "y",
): readonly AxisReferencePair[] {
  const physicalById = new Map<string, PhysicalReferenceLine>();
  for (const reference of field.physicalGeometry.referenceLines) {
    if (reference.axis === axis) physicalById.set(reference.id, reference);
  }

  const pairs: AxisReferencePair[] = [];
  for (const gridReference of field.marchingGrid.referenceLines) {
    if (gridReference.axis !== axis) continue;
    const physicalReference = physicalById.get(gridReference.id);
    if (!physicalReference) continue;
    pairs.push({
      id: gridReference.id,
      grid: gridReference.coordinateSteps,
      physical: physicalReference.coordinateMeters,
    });
  }

  if (pairs.length < 2) {
    throw new RangeError(
      `Field must define at least two matched ${axis.toUpperCase()} reference lines.`,
    );
  }
  return pairs.sort((a, b) => a.grid - b.grid);
}

function projectAxis(
  value: number,
  pairs: readonly AxisReferencePair[],
  from: "grid" | "physical",
  to: "grid" | "physical",
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Projected coordinate must be finite.");
  }

  const sorted = [...pairs].sort((a, b) => a[from] - b[from]);
  const segment = findSegment(value, sorted, from);
  const start = segment[0];
  const end = segment[1];
  const fromSpan = end[from] - start[from];
  if (Math.abs(fromSpan) < Number.EPSILON) {
    throw new RangeError(
      `Field projection has duplicate ${from} coordinates for ${start.id} and ${end.id}.`,
    );
  }
  const ratio = (value - start[from]) / fromSpan;
  return start[to] + ratio * (end[to] - start[to]);
}

function findSegment(
  value: number,
  sorted: readonly AxisReferencePair[],
  key: "grid" | "physical",
): readonly [AxisReferencePair, AxisReferencePair] {
  if (value <= sorted[0][key]) return [sorted[0], sorted[1]];
  const lastIndex = sorted.length - 1;
  if (value >= sorted[lastIndex][key]) {
    return [sorted[lastIndex - 1], sorted[lastIndex]];
  }
  for (let index = 0; index < lastIndex; index += 1) {
    if (value >= sorted[index][key] && value <= sorted[index + 1][key]) {
      return [sorted[index], sorted[index + 1]];
    }
  }
  return [sorted[0], sorted[1]];
}

export function getGridReference(
  field: FieldDefinition | ResolvedFieldDefinition,
  id: string,
): MarchingReferenceLine | undefined {
  const resolved = isResolvedField(field) ? field : resolveFieldDefinition(field);
  return resolved.marchingGrid.referenceLines.find((line) => line.id === id);
}
