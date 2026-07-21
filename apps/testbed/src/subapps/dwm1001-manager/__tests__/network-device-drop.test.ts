import {
  findNetworkDropTarget,
  type NetworkDropZone,
} from "../components/network-device-drop";

const zones: NetworkDropZone[] = [
  { networkId: "first", left: 10, top: 20, right: 110, bottom: 60 },
  { networkId: "second", left: 10, top: 60, right: 110, bottom: 100 },
];

describe("findNetworkDropTarget", () => {
  test("uses inclusive leading and exclusive trailing rectangle edges", () => {
    expect(findNetworkDropTarget(zones, { x: 10, y: 20 })).toBe("first");
    expect(findNetworkDropTarget(zones, { x: 109.99, y: 59.99 })).toBe("first");
    expect(findNetworkDropTarget(zones, { x: 10, y: 60 })).toBe("second");
    expect(findNetworkDropTarget(zones, { x: 110, y: 60 })).toBeUndefined();
    expect(findNetworkDropTarget(zones, { x: 10, y: 100 })).toBeUndefined();
  });

  test("returns a deterministic target for overlapping input order", () => {
    const overlap = [
      { networkId: "later", left: 0, top: 20, right: 100, bottom: 80 },
      { networkId: "earlier", left: 0, top: 10, right: 100, bottom: 90 },
    ];
    expect(findNetworkDropTarget(overlap, { x: 50, y: 50 })).toBe("earlier");
    expect(
      findNetworkDropTarget([...overlap].reverse(), { x: 50, y: 50 }),
    ).toBe("earlier");
  });
});
