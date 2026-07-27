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
 * Resolve by preview midpoint Y first because previews are vertically constrained.
 * X breaks ties when layouts overlap; vertically stacked cards remain targetable
 * even when their horizontal measurements differ slightly.
 */
export function findNetworkDropTarget(
  zones: readonly NetworkDropZone[],
  point: NetworkDropPoint,
): string | undefined {
  const verticalMatches = [...zones]
    .sort(compareDropZones)
    .filter((zone) => point.y >= zone.top && point.y < zone.bottom);
  return (
    verticalMatches.find(
      (zone) => point.x >= zone.left && point.x < zone.right,
    ) ?? verticalMatches[0]
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
