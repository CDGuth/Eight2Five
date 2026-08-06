import {
  applyFieldCameraTransform,
  clampFieldViewport,
  createFieldPanBaseline,
  fieldCameraTransform,
  fieldCenterForStationaryWorldPoint,
  fieldPanCenter,
  fieldScreenToWorld,
  fieldWorldToScreen,
} from "../camera/field-camera-math";
import {
  FIELD_CAMERA_BLANK_MARGIN_YARDS,
  FIELD_CAMERA_TOTAL_EXTERIOR_ALLOWANCE_YARDS,
  FIELD_GRID_PERIMETER_YARDS,
  FIELD_MIN_METERS_PER_PIXEL,
  getFieldCameraBounds,
  getFieldGridBounds,
  getFieldMaximumMetersPerPixel,
} from "../camera/field-camera-policy";
import { STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE } from "../template";
import { metersToYards } from "../units";

const size = { width: 800, height: 400 };
const portraitSize = { width: 400, height: 800 };
const viewport = {
  centerXMeters: 45,
  centerYMeters: 20,
  metersPerPixel: 0.1,
};

describe("field camera math", () => {
  test("round-trips world and screen points and matches the Skia transform", () => {
    const point = { xMeters: 49.25, yMeters: 18.5 };
    const screen = fieldWorldToScreen(point, viewport, size);

    expect(fieldScreenToWorld(screen, viewport, size)).toEqual(point);
    expect(
      applyFieldCameraTransform(point, fieldCameraTransform(viewport, size)),
    ).toEqual(screen);
  });

  test("rotates performer perspective by 180 degrees and round-trips it", () => {
    const point = { xMeters: 49.25, yMeters: 18.5 };
    const director = fieldWorldToScreen(point, viewport, size, "director");
    const performer = fieldWorldToScreen(point, viewport, size, "performer");

    expect(performer.x - size.width / 2).toBeCloseTo(
      -(director.x - size.width / 2),
      10,
    );
    expect(performer.y - size.height / 2).toBeCloseTo(
      -(director.y - size.height / 2),
      10,
    );
    expect(fieldScreenToWorld(performer, viewport, size, "performer")).toEqual(
      point,
    );
    expect(
      applyFieldCameraTransform(
        point,
        fieldCameraTransform(viewport, size, "performer"),
      ),
    ).toEqual(performer);
  });

  test("preserves the world point beneath a pinch focal point", () => {
    const focal = { x: 155, y: 92 };
    const world = fieldScreenToWorld(focal, viewport, size);
    const nextScale = 0.05;
    const center = fieldCenterForStationaryWorldPoint(
      world,
      focal,
      size,
      nextScale,
    );

    const preserved = fieldWorldToScreen(
      world,
      {
        centerXMeters: center.xMeters,
        centerYMeters: center.yMeters,
        metersPerPixel: nextScale,
      },
      size,
    );
    expect(preserved.x).toBeCloseTo(focal.x, 10);
    expect(preserved.y).toBeCloseTo(focal.y, 10);
  });

  test("clamps using the visible half span and centers oversized viewports", () => {
    const bounds = {
      minXMeters: 0,
      maxXMeters: 100,
      minYMeters: 0,
      maxYMeters: 50,
    };
    expect(
      clampFieldViewport(
        { centerXMeters: -50, centerYMeters: 100, metersPerPixel: 0.1 },
        size,
        bounds,
      ),
    ).toEqual({
      centerXMeters: 40,
      centerYMeters: 30,
      metersPerPixel: 0.1,
    });
    expect(
      clampFieldViewport(
        { centerXMeters: 10, centerYMeters: 10, metersPerPixel: 1 },
        size,
        bounds,
      ),
    ).toMatchObject({ centerXMeters: 50, centerYMeters: 25 });
  });

  test("clamps panning to the exterior camera allowance in both orientations", () => {
    const bounds = getFieldCameraBounds();
    const metersPerPixel = 0.1;

    for (const currentSize of [size, portraitSize]) {
      const clamped = clampFieldViewport(
        {
          centerXMeters: bounds.minXMeters - 100,
          centerYMeters: bounds.maxYMeters + 100,
          metersPerPixel,
        },
        currentSize,
        bounds,
      );

      expect(clamped.centerXMeters).toBeCloseTo(
        bounds.minXMeters + (currentSize.width * metersPerPixel) / 2,
        10,
      );
      expect(clamped.centerYMeters).toBeCloseTo(
        bounds.maxYMeters - (currentSize.height * metersPerPixel) / 2,
        10,
      );
    }
  });

  test("rebases pan translation after a pinch pointer transition", () => {
    const current = { xMeters: 30, yMeters: 12 };
    const rebased = createFieldPanBaseline(current, 84, -20, 0.1);

    expect(fieldPanCenter(rebased, 84, -20)).toEqual(current);
    expect(fieldPanCenter(rebased, 94, -15)).toEqual({
      xMeters: 29,
      yMeters: 12.5,
    });
  });

  test("keeps zoom limits centralized around the padded field", () => {
    const gridBounds = getFieldGridBounds();
    const cameraBounds = getFieldCameraBounds();
    const maximum = getFieldMaximumMetersPerPixel(size, gridBounds);

    expect(FIELD_MIN_METERS_PER_PIXEL).toBe(0.02);
    expect(maximum).toBeGreaterThan(FIELD_MIN_METERS_PER_PIXEL);
    expect(cameraBounds.minXMeters).toBeLessThan(gridBounds.minXMeters);
    expect(cameraBounds.maxYMeters).toBeGreaterThan(gridBounds.maxYMeters);
  });

  test("keeps the rendered grid at 10 yards and allows 30 yards outside the field", () => {
    const gridBounds = getFieldGridBounds();
    const cameraBounds = getFieldCameraBounds();

    expect(FIELD_GRID_PERIMETER_YARDS).toBe(10);
    expect(FIELD_CAMERA_BLANK_MARGIN_YARDS).toBe(20);
    expect(FIELD_CAMERA_TOTAL_EXTERIOR_ALLOWANCE_YARDS).toBe(30);
    expect(
      metersToYards(
        STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE.bounds.minXMeters -
          gridBounds.minXMeters,
      ),
    ).toBeCloseTo(FIELD_GRID_PERIMETER_YARDS, 10);
    expect(
      metersToYards(
        STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE.bounds.minXMeters -
          cameraBounds.minXMeters,
      ),
    ).toBeCloseTo(FIELD_CAMERA_TOTAL_EXTERIOR_ALLOWANCE_YARDS, 10);
    expect(
      metersToYards(gridBounds.minXMeters - cameraBounds.minXMeters),
    ).toBeCloseTo(FIELD_CAMERA_BLANK_MARGIN_YARDS, 10);
  });
});
