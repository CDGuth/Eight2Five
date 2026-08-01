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
  FIELD_MIN_METERS_PER_PIXEL,
  getFieldCameraBounds,
  getFieldGridBounds,
  getFieldMaximumMetersPerPixel,
} from "../camera/field-camera-policy";

const size = { width: 800, height: 400 };
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
});
