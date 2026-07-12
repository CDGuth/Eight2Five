import {
  boundsForPoints,
  chooseGridInterval,
  fitGridBounds,
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
});
