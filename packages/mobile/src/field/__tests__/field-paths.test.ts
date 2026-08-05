import {
  drillGridToPhysicalPoint,
  FIELD_PRESET_IDS,
} from "@eight2five/drill-schema";

import { createFieldPaths } from "../render/create-field-paths";
import {
  createStandardFootballFieldTemplate,
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
} from "../template";
import { yardsToMeters } from "../units";

const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
const PRESETS = FIELD_PRESET_IDS;

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
    expect(paths.stepGridSpacingSteps).toBe(1);
    expect(paths.fourStepGridSpacingSteps).toBe(4);
    expect(paths.counts.stepGrid.spacingSteps).toBe(1);
  });

  test.each(PRESETS)(
    "%s projects the canonical 160 by 84 one-step marching grid onto the field",
    (preset) => {
      const template = createStandardFootballFieldTemplate(preset);
      const paths = createFieldPaths(template);
      const bounds = template.fieldDefinition.marchingGrid.bounds;

      expect(bounds).toEqual({
        minXSteps: -80,
        maxXSteps: 80,
        minYSteps: 0,
        maxYSteps: 84,
      });
      expect(paths.counts.stepGrid).toMatchObject({
        spacingSteps: 1,
        verticalLineCount: 161,
        horizontalLineCount: 85,
      });
      expect(subpathCount(paths.stepGridPath)).toBe(246);

      const frontHash = gridPoint(
        template,
        0,
        gridReference(template, "front-hash"),
      );
      const backHash = gridPoint(
        template,
        0,
        gridReference(template, "back-hash"),
      );
      const backSideline = gridPoint(template, 0, 84);
      expect(frontHash.yMeters).toBeCloseTo(
        template.frontHashLine.coordinateMeters,
        8,
      );
      expect(backHash.yMeters).toBeCloseTo(
        template.backHashLine.coordinateMeters,
        8,
      );
      expect(backSideline.yMeters).toBeCloseTo(template.bounds.maxYMeters, 8);

      const frontHashSteps = gridReference(template, "front-hash");
      const backHashSteps = gridReference(template, "back-hash");
      if (Number.isInteger(frontHashSteps)) {
        expect(paths.stepGridPath).toContain(
          horizontalSegment(
            template.bounds.minXMeters,
            frontHash.yMeters,
            template.bounds.maxXMeters,
          ),
        );
      }
      if (Number.isInteger(backHashSteps)) {
        expect(paths.stepGridPath).toContain(
          horizontalSegment(
            template.bounds.minXMeters,
            backHash.yMeters,
            template.bounds.maxXMeters,
          ),
        );
      }
    },
  );

  test("NFHS hashes are exactly 28, 28, 28 marching steps apart", () => {
    const template = createStandardFootballFieldTemplate("football-nfhs");
    expect(gridReference(template, "front-sideline")).toBe(0);
    expect(gridReference(template, "front-hash")).toBe(28);
    expect(gridReference(template, "back-hash")).toBe(56);
    expect(gridReference(template, "back-sideline")).toBe(84);
  });

  test.each(PRESETS)(
    "%s renders the blue overlay as four marching-step boxes",
    (preset) => {
      const template = createStandardFootballFieldTemplate(preset);
      const paths = createFieldPaths(template);
      const coordinates = parseCoordinates(paths.fourStepGridPath);

      for (const { xMeters, yMeters } of coordinates) {
        expect(xMeters).toBeGreaterThanOrEqual(
          template.bounds.minXMeters - 1e-6,
        );
        expect(xMeters).toBeLessThanOrEqual(template.bounds.maxXMeters + 1e-6);
        expect(yMeters).toBeGreaterThanOrEqual(
          template.bounds.minYMeters - 1e-6,
        );
        expect(yMeters).toBeLessThanOrEqual(template.bounds.maxYMeters + 1e-6);
      }

      expect(paths.counts.fourStepGrid).toMatchObject({
        spacingSteps: 4,
        verticalSubdivisionCount: 41,
        horizontalSubdivisionCount: 22,
        segmentCount: 63,
        clippedToField: true,
      });
      expect(subpathCount(paths.fourStepGridPath)).toBe(63);
      expect(paths.fourStepGridPath).toContain(
        horizontalSegment(
          template.bounds.minXMeters,
          gridPoint(template, 0, 84).yMeters,
          template.bounds.maxXMeters,
        ),
      );
    },
  );

  test.each(PRESETS)(
    "%s optional one-step perimeter grid extends beyond every field edge",
    (preset) => {
      const template = createStandardFootballFieldTemplate(preset);
      const paths = createFieldPaths(template);
      const subpaths = parseSubpaths(paths.perimeterStepGridPath);

      expect(paths.counts.perimeterStepGrid.spacingSteps).toBe(1);
      expect(paths.counts.perimeterStepGrid.clippedByFieldBackground).toBe(
        true,
      );
      expect(
        subpaths.some(
          ({ x1, x2 }) => x1 === x2 && x1 < template.bounds.minXMeters,
        ),
      ).toBe(true);
      expect(
        subpaths.some(
          ({ x1, x2 }) => x1 === x2 && x1 > template.bounds.maxXMeters,
        ),
      ).toBe(true);
      expect(
        subpaths.some(
          ({ y1, y2 }) => y1 === y2 && y1 < template.bounds.minYMeters,
        ),
      ).toBe(true);
      expect(
        subpaths.some(
          ({ y1, y2 }) => y1 === y2 && y1 > template.bounds.maxYMeters,
        ),
      ).toBe(true);
    },
  );

  test("renders perpendicular inbounds hashes without treating guides as ticks", () => {
    const paths = createFieldPaths(field);
    const hashSegments = parseSubpaths(paths.hashMarksPath);

    expect(subpathCount(paths.yardLinesPath)).toBe(19);
    expect(paths.counts.yardLines.lineCount).toBe(19);
    expect(hashSegments).toHaveLength(198);
    expect(
      hashSegments.every(
        ({ x1, y1, x2, y2 }) =>
          y1 === y2 &&
          Math.abs(
            x2 -
              x1 -
              field.fieldDefinition.markings.inboundsHashMarks.lengthMeters,
          ) < 1e-6,
      ),
    ).toBe(true);
    expect(paths.counts.hashMarks).toMatchObject({
      rowCount: 2,
      ticksPerRow: 99,
      tickCount: 198,
      spacingMeters:
        field.fieldDefinition.markings.inboundsHashMarks.spacingMeters,
      tickLengthMeters:
        field.fieldDefinition.markings.inboundsHashMarks.lengthMeters,
    });
    expect(subpathCount(paths.hashGuideLinesPath)).toBe(2);
    expect(paths.counts.hashGuideLines.lineCount).toBe(2);
    expect(subpathCount(paths.boundaryPath)).toBe(1);
    expect(paths.boundaryPath.endsWith(" Z")).toBe(true);
    expect(paths.counts.boundary.segmentCount).toBe(1);
  });

  test.each(PRESETS)(
    "%s renders preset sideline marks at one-yard positions between full yard lines",
    (preset) => {
      const template = createStandardFootballFieldTemplate(preset);
      const paths = createFieldPaths(template);
      const segments = parseSubpaths(paths.sidelineHashMarksPath);
      const markings = template.fieldDefinition.markings.sidelineHashMarks;

      expect(segments).toHaveLength(160);
      expect(paths.counts.sidelineHashMarks).toEqual({
        spacingMeters: markings.spacingMeters,
        markLengthMeters: markings.lengthMeters,
        insetFromSidelineMeters: markings.insetFromSidelineMeters,
        rowCount: 2,
        marksPerRow: 80,
        markCount: 160,
      });
      expect(
        segments.every(
          ({ x1, y1, x2, y2 }) =>
            x1 === x2 &&
            Math.abs(Math.abs(y2 - y1) - markings.lengthMeters) < 1e-6,
        ),
      ).toBe(true);
      expect(
        segments.every(({ x1 }) => {
          const yardsFromGoalLine =
            (x1 - template.bounds.minXMeters) / yardsToMeters(1);
          return Math.abs(yardsFromGoalLine % 5) > 1e-6;
        }),
      ).toBe(true);
      const front = segments.find(
        ({ y1, y2 }) =>
          y1 < template.widthMeters / 2 && y2 < template.widthMeters / 2,
      )!;
      const back = segments.find(
        ({ y1, y2 }) =>
          y1 > template.widthMeters / 2 && y2 > template.widthMeters / 2,
      )!;
      expect(front.y1 - template.bounds.minYMeters).toBeCloseTo(
        markings.insetFromSidelineMeters,
      );
      expect(template.bounds.maxYMeters - back.y2).toBeCloseTo(
        markings.insetFromSidelineMeters,
      );
    },
  );
});

function gridReference(
  template: ReturnType<typeof createStandardFootballFieldTemplate>,
  id: string,
): number {
  const reference = template.fieldDefinition.marchingGrid.referenceLines.find(
    (line) => line.id === id,
  );
  if (!reference) throw new Error(`Missing grid reference ${id}.`);
  return reference.coordinateSteps;
}

function gridPoint(
  template: ReturnType<typeof createStandardFootballFieldTemplate>,
  xSteps: number,
  ySteps: number,
) {
  return drillGridToPhysicalPoint({ xSteps, ySteps }, template.fieldDefinition);
}

function horizontalSegment(
  minXMeters: number,
  yMeters: number,
  maxXMeters: number,
): string {
  return `M ${format(minXMeters)} ${format(yMeters)} L ${format(
    maxXMeters,
  )} ${format(yMeters)}`;
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

function parseSubpaths(path: string): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}[] {
  return Array.from(
    path.matchAll(
      /M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) L (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
    ),
    (match) => ({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
    }),
  );
}

function subpathCount(path: string): number {
  return path.length === 0 ? 0 : (path.match(/M /g)?.length ?? 0);
}

function format(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
