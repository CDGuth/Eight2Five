export interface NetworkDropPoint {
  x: number;
  y: number;
}

export interface NetworkDropZone {
  networkId: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Header rectangles use inclusive leading edges and exclusive trailing edges.
 * Adjacent rectangles therefore cannot both own a point on their shared edge.
 */
export function findNetworkDropTarget(
  zones: readonly NetworkDropZone[],
  point: NetworkDropPoint,
): string | undefined {
  return [...zones]
    .sort(compareDropZones)
    .find(
      (zone) =>
        point.x >= zone.left &&
        point.x < zone.right &&
        point.y >= zone.top &&
        point.y < zone.bottom,
    )?.networkId;
}

function compareDropZones(left: NetworkDropZone, right: NetworkDropZone) {
  return (
    left.top - right.top ||
    left.left - right.left ||
    left.bottom - left.top - (right.bottom - right.top) ||
    left.right - left.left - (right.right - right.left) ||
    left.networkId.localeCompare(right.networkId)
  );
}
