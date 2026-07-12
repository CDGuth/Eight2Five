import { deriveObservedTopology } from "../PansTopologyService";
import type { PansTopologyObservation } from "../types";

describe("deriveObservedTopology", () => {
  test("derives only observed directional edges and retains cluster evidence", () => {
    const observations: PansTopologyObservation[] = [
      {
        deviceId: "anchor-a",
        transportDeviceId: "transport-a",
        localNodeIdHex: "0x000A",
        observedAt: 1,
        anchorList: {
          anchors: [{ nodeIdHex: "000b", lowNodeId: 11 }],
          raw: [],
          diagnostics: [],
        },
        clusterInfo: {
          seatNumber: 2,
          clusterMap: 3,
          clusterNeighborMap: 1,
          raw: [],
        },
        errors: [],
      },
      {
        deviceId: "anchor-b",
        transportDeviceId: "transport-b",
        localNodeIdHex: "000B",
        observedAt: 1,
        anchorList: { anchors: [], raw: [], diagnostics: [] },
        errors: [],
      },
    ];

    const topology = deriveObservedTopology(observations, 10);

    expect(topology.edges).toEqual([
      {
        sourceKey: "node:000A",
        targetKey: "node:000B",
        observedByDeviceId: "anchor-a",
      },
    ]);
    expect(topology.nodes.find((node) => node.key === "node:000B")).toEqual(
      expect.objectContaining({ localDeviceId: "anchor-b" }),
    );
    expect(topology.observations[0].clusterInfo?.seatNumber).toBe(2);
    expect(topology.uncertainty).toContain("missing edge does not prove");
    expect(topology.edges).not.toContainEqual(
      expect.objectContaining({ sourceKey: "node:000B" }),
    );
  });
});
