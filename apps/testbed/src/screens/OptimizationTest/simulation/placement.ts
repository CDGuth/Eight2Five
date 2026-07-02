import { AnchorGeometry } from "@eight2five/mobile/localization/types";

export type PlacementMode = "random" | "border" | "grid";

/**
 * Computes a set of 2D points distributed across a `w` x `l` field according
 * to the given placement `mode`, optionally perturbed by Gaussian noise of
 * standard deviation `sigma`.
 *
 * This is a pure function: it relies only on its inputs and `Math.random`.
 */
export function calculatePlacement(
  mode: PlacementMode,
  n: number,
  w: number,
  l: number,
  sigma: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  if (mode === "random") {
    for (let i = 0; i < n; i++) {
      points.push({ x: Math.random() * w, y: Math.random() * l });
    }
  } else if (mode === "grid") {
    const ratio = l / w;
    let cols = Math.max(1, Math.round(Math.sqrt(n / ratio)));
    let rows = Math.ceil(n / cols);
    if (cols * (rows - 1) >= n) rows--;

    const stepX = w / cols;
    const stepY = l / rows;

    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const numInRow = r === rows - 1 ? n % cols || cols : cols;
      const rowOffset = ((cols - numInRow) * stepX) / 2;
      const x = (c + 0.5) * stepX + rowOffset;
      const y = (r + 0.5) * stepY;
      points.push({ x, y });
    }
  } else {
    // Border
    const perimeter = 2 * (w + l);
    const step = perimeter / n;
    for (let i = 0; i < n; i++) {
      const dist = i * step;
      let x = 0,
        y = 0;
      if (dist < w) {
        x = dist;
        y = 0;
      } else if (dist < w + l) {
        x = w;
        y = dist - w;
      } else if (dist < 2 * w + l) {
        x = w - (dist - (w + l));
        y = l;
      } else {
        x = 0;
        y = l - (dist - (2 * w + l));
      }
      points.push({ x, y });
    }
  }

  if (sigma > 0) {
    points.forEach((p) => {
      const u1 = Math.random();
      const u2 = Math.random();
      const mag = Math.sqrt(-2.0 * Math.log(u1)) * sigma;
      const phase = 2.0 * Math.PI * u2;
      p.x = Math.max(0, Math.min(w, p.x + mag * Math.cos(phase)));
      p.y = Math.max(0, Math.min(l, p.y + mag * Math.sin(phase)));
    });
  }
  return points;
}

/**
 * Converts a list of 2D points into anchor geometries, assigning each a MAC
 * address derived from `macPrefix` and its zero-based index.
 */
export function pointsToAnchors(
  points: { x: number; y: number }[],
  macPrefix = "00:11:22:33:44:0",
): AnchorGeometry[] {
  return points.map((p, i) => ({
    mac: `${macPrefix}${i}`,
    x: p.x,
    y: p.y,
  }));
}
