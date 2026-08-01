import { createFieldPaths } from "../render/create-field-paths";
import { STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE } from "../template";
import { STANDARD_STEP_METERS, yardsToMeters } from "../units";

const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;

describe("aggregate field paths", () => {
  test("returns one immutable, memoized path set per template", () => {
    const first = createFieldPaths(field);
    const second = createFieldPaths(field);

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.fieldExtent)).toBe(true);
    expect(Object.isFrozen(first.gridExtent)).toBe(true);
    expect(Object.isFrozen(first.counts)).toBe(true);
    expect(Object.isFrozen(first.counts.stepGrid)).toBe(true);
  });

  test("exposes exact field and ten-yard padded grid extents", () => {
    const paths = createFieldPaths(field);
    const paddingMeters = yardsToMeters(10);

    expect(paths.fieldExtent).toEqual(field.bounds);
    expect(paths.gridExtent).toEqual({
      minXMeters: field.bounds.minXMeters - paddingMeters,
      maxXMeters: field.bounds.maxXMeters + paddingMeters,
      minYMeters: field.bounds.minYMeters - paddingMeters,
      maxYMeters: field.bounds.maxYMeters + paddingMeters,
    });
    expect(paths.extents).toEqual({
      field: paths.fieldExtent,
      grid: paths.gridExtent,
    });
    expect(paths.stepGridSpacingMeters).toBe(STANDARD_STEP_METERS);
    expect(paths.counts.stepGrid.spacingMeters).toBe(STANDARD_STEP_METERS);
  });

  test("clips the fixed-spacing step grid at the exact padded extent", () => {
    const paths = createFieldPaths(field);
    const { minXMeters, maxXMeters, minYMeters, maxYMeters } = paths.gridExtent;

    expect(paths.stepGridPath).toContain(
      segment(minXMeters, minYMeters, minXMeters, maxYMeters),
    );
    expect(paths.stepGridPath).toContain(
      segment(minXMeters, minYMeters, maxXMeters, minYMeters),
    );
    expect(paths.stepGridPath.split(" M ").length).toBe(
      paths.counts.stepGrid.verticalLineCount +
        paths.counts.stepGrid.horizontalLineCount,
    );

    const verticalX = Array.from(
      paths.stepGridPath.matchAll(/M (-?\d+(?:\.\d+)?) /g),
      (match) => Number(match[1]),
    ).slice(0, paths.counts.stepGrid.verticalLineCount);
    for (let index = 1; index < verticalX.length; index += 1) {
      expect(verticalX[index] - verticalX[index - 1]).toBeCloseTo(
        STANDARD_STEP_METERS,
        6,
      );
    }
  });

  test("clips the five-yard grid to the field and includes both axes", () => {
    const paths = createFieldPaths(field);
    const coordinates = parseCoordinates(paths.fiveYardGridPath);

    for (const { xMeters, yMeters } of coordinates) {
      expect(xMeters).toBeGreaterThanOrEqual(field.bounds.minXMeters);
      expect(xMeters).toBeLessThanOrEqual(field.bounds.maxXMeters);
      expect(yMeters).toBeGreaterThanOrEqual(field.bounds.minYMeters);
      expect(yMeters).toBeLessThanOrEqual(field.bounds.maxYMeters);
    }

    expect(paths.counts.fiveYardGrid).toMatchObject({
      spacingMeters: yardsToMeters(5),
      verticalSubdivisionCount: 21,
      horizontalSubdivisionCount: 11,
      segmentCount: 32,
      clippedToField: true,
    });
    expect(paths.fiveYardGridPath).toContain(
      segment(
        field.bounds.minXMeters,
        field.bounds.minYMeters,
        field.bounds.maxXMeters,
        field.bounds.minYMeters,
      ),
    );
  });

  test("keeps football marks aggregate and exposes stable shape counts", () => {
    const paths = createFieldPaths(field);

    expect(subpathCount(paths.yardLinesPath)).toBe(19);
    expect(paths.counts.yardLines.lineCount).toBe(19);
    expect(subpathCount(paths.hashMarksPath)).toBe(198);
    expect(paths.counts.hashMarks).toMatchObject({
      rowCount: 2,
      ticksPerRow: 99,
      tickCount: 198,
      spacingMeters: yardsToMeters(1),
    });
    expect(subpathCount(paths.boundaryPath)).toBe(1);
    expect(paths.boundaryPath.endsWith(" Z")).toBe(true);
    expect(paths.counts.boundary.segmentCount).toBe(1);
  });
});

function segment(
  startXMeters: number,
  startYMeters: number,
  endXMeters: number,
  endYMeters: number,
): string {
  return `M ${format(startXMeters)} ${format(startYMeters)} L ${format(endXMeters)} ${format(endYMeters)}`;
}

function parseCoordinates(path: string): {
  xMeters: number;
  yMeters: number;
}[] {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const coordinates: { xMeters: number; yMeters: number }[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    coordinates.push({ xMeters: values[index], yMeters: values[index + 1] });
  }
  return coordinates;
}

function subpathCount(path: string): number {
  return path.length === 0 ? 0 : (path.match(/M /g)?.length ?? 0);
}

function format(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
