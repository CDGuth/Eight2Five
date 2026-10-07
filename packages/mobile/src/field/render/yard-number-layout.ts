export interface TextVisualBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface YardNumberTextLayout {
  /** Baseline origin before the orientation transform is applied. */
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly visualWidthMeters: number;
  readonly visualHeightMeters: number;
}

/**
 * Centers measured glyph bounds at the origin and scales their visual height
 * to the schema-defined physical height. Front- and back-sideline rows are
 * physically opposed so the bottom of each number faces its nearest sideline,
 * matching a real football field. Camera perspective then rotates the entire
 * field naturally instead of re-orienting each number for the viewer.
 */
export function createYardNumberTextLayout(
  bounds: TextVisualBounds,
  targetHeightMeters: number,
  side: "front" | "back",
): YardNumberTextLayout {
  if (
    !Number.isFinite(targetHeightMeters) ||
    targetHeightMeters <= 0 ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    bounds.width < 0 ||
    !Number.isFinite(bounds.height) ||
    bounds.height <= 0
  ) {
    throw new RangeError(
      "Yard-number text bounds and height must be finite and positive.",
    );
  }

  const scale = targetHeightMeters / bounds.height;
  const orientation = side === "front" ? 1 : -1;
  return Object.freeze({
    x: -bounds.x - bounds.width / 2,
    y: -bounds.y - bounds.height / 2,
    scaleX: scale * orientation,
    scaleY: -scale * orientation,
    visualWidthMeters: bounds.width * scale,
    visualHeightMeters: bounds.height * scale,
  });
}
