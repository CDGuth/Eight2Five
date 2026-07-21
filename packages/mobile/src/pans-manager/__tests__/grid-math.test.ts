import {
  applyGridCameraTransform,
  buildConsolidatedEdgePath,
  buildConsolidatedGridPath,
  boundsForPoints,
  chooseGridInterval,
  fitGridBounds,
  gridCameraTransform,
  normalizeGridViewport,
  panGridViewport,
  screenToWorld,
  worldToScreen,
  zoomGridViewport,
} from "../pans-network-grid-math";

describe("PansNetworkGrid math", () => {
  test("maps X right and Y up with an invertible screen transform", () => {
    const viewport = {
      centerXMeters: 5,
      centerYMeters: 10,
      metersPerPixel: 0.5,
    };
    const size = { width: 200, height: 100 };
    const screen = worldToScreen({ xMeters: 15, yMeters: 15 }, viewport, size);
    expect(screen).toEqual({ x: 120, y: 40 });
    expect(screenToWorld(screen, viewport, size)).toEqual({
      xMeters: 15,
      yMeters: 15,
    });
  });

  test("chooses human-friendly grid intervals", () => {
    expect(chooseGridInterval(0.01)).toBe(1);
    expect(chooseGridInterval(0.03)).toBe(5);
    expect(chooseGridInterval(0.1)).toBe(10);
  });

  test("fits point bounds with padding and stable single-point scale", () => {
    const bounds = boundsForPoints([
      { xMeters: -10, yMeters: -5 },
      { xMeters: 10, yMeters: 5 },
    ]);
    expect(fitGridBounds(bounds, { width: 300, height: 200 }, 50)).toEqual({
      centerXMeters: 0,
      centerYMeters: 0,
      metersPerPixel: 0.1,
    });
    expect(
      fitGridBounds(boundsForPoints([{ xMeters: 2, yMeters: 3 }]), {
        width: 200,
        height: 100,
      }).metersPerPixel,
    ).toBeGreaterThan(0);
  });

  test("pans from a gesture snapshot and zooms around the focal point", () => {
    const viewport = {
      centerXMeters: 0,
      centerYMeters: 0,
      metersPerPixel: 1,
    };
    expect(panGridViewport(viewport, { x: 10, y: -5 })).toEqual({
      centerXMeters: -10,
      centerYMeters: -5,
      metersPerPixel: 1,
    });
    const size = { width: 200, height: 100 };
    const focal = { x: 150, y: 25 };
    const before = screenToWorld(focal, viewport, size);
    const zoomed = zoomGridViewport(viewport, size, focal, 2);
    expect(zoomed.metersPerPixel).toBe(0.5);
    expect(screenToWorld(focal, zoomed, size)).toEqual(before);
  });

  test("keeps the affine Skia camera transform in parity with worldToScreen", () => {
    const viewport = {
      centerXMeters: 4,
      centerYMeters: -3,
      metersPerPixel: 0.25,
    };
    const size = { width: 320, height: 180 };
    const point = { xMeters: 12, yMeters: 2 };
    expect(
      applyGridCameraTransform(point, gridCameraTransform(viewport, size)),
    ).toEqual(worldToScreen(point, viewport, size));
  });

  test("normalizes invalid camera values and clamps scale", () => {
    expect(
      normalizeGridViewport({
        centerXMeters: Number.NaN,
        centerYMeters: Number.POSITIVE_INFINITY,
        metersPerPixel: 0,
      }),
    ).toEqual({ centerXMeters: 0, centerYMeters: 0, metersPerPixel: 0.0001 });
    expect(
      normalizeGridViewport({
        centerXMeters: 1,
        centerYMeters: 2,
        metersPerPixel: Number.MAX_VALUE,
      }).metersPerPixel,
    ).toBe(10_000);
  });

  test("consolidates grid, origin, and resolved edges into path strings", () => {
    const viewport = {
      centerXMeters: 0,
      centerYMeters: 0,
      metersPerPixel: 1,
    };
    const grid = buildConsolidatedGridPath(
      viewport,
      { width: 4, height: 4 },
      2,
      { overscanScreens: 0, showOrigin: true },
    );
    expect(grid).toContain("M -2 -2 L -2 2");
    expect(grid).toContain("M -2 0 L 2 0");
    expect(
      buildConsolidatedGridPath(viewport, { width: 4, height: 4 }, 2, {
        showGrid: false,
        showOrigin: false,
      }),
    ).toBe("");

    const points = new Map([
      ["tag", { xMeters: 1, yMeters: 2 }],
      ["anchor", { xMeters: 3, yMeters: 4 }],
    ]);
    expect(
      buildConsolidatedEdgePath(points, [
        { sourceId: "tag", targetId: "anchor" },
        { sourceId: "tag", targetId: "missing" },
      ]),
    ).toBe("M 1 2 L 3 4");
  });
});
