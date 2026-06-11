import {
  configureAnchorNode,
  configureTag,
  observeTagAnchors,
  readAnchorNeighborLowIds,
  readAnchorNeighbors,
} from "../PansProvisioning";

jest.mock("expo-pans-ble-api", () => ({
  connect: jest.fn(async () => true),
  disconnect: jest.fn(async () => true),
  patchOperationMode: jest.fn(async () => ({ raw: [0, 0] })),
  writeLocationDataMode: jest.fn(async () => true),
  writeNetworkId: jest.fn(async () => true),
  writePersistedPosition: jest.fn(async () => true),
  readLocationData: jest.fn(async () => ({
    distances: [],
    raw: [],
    diagnostics: [],
  })),
  readOperationMode: jest.fn(async () => ({ raw: [0, 0] })),
  readAnchorList: jest.fn(async () => ({
    anchors: [],
    raw: [],
    diagnostics: [],
  })),
}));

const pans = jest.requireMock("expo-pans-ble-api") as {
  connect: jest.Mock;
  disconnect: jest.Mock;
  patchOperationMode: jest.Mock;
  writeLocationDataMode: jest.Mock;
  writeNetworkId: jest.Mock;
  writePersistedPosition: jest.Mock;
  readLocationData: jest.Mock;
  readAnchorList: jest.Mock;
};

describe("PansProvisioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pans.connect.mockResolvedValue(true);
    pans.readLocationData.mockResolvedValue({
      distances: [],
      raw: [],
      diagnostics: [],
    });
    pans.readAnchorList.mockResolvedValue({
      anchors: [],
      raw: [],
      diagnostics: [],
    });
  });

  test("configureTag connects, patches mode, writes PAN and location mode", async () => {
    await expect(
      configureTag("tag-1", {
        useInternalLocationSolver: false,
        locationDataMode: 1,
        panId: 0x1234,
        disconnectAfterSetup: true,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(pans.connect).toHaveBeenCalledWith("tag-1", 10_000);
    expect(pans.patchOperationMode).toHaveBeenCalledWith("tag-1", {
      role: "tag",
      uwbMode: "active",
      initiatorEnabled: false,
      locationEngineEnabled: false,
    });
    expect(pans.writeNetworkId).toHaveBeenCalledWith("tag-1", 0x1234);
    expect(pans.writeLocationDataMode).toHaveBeenCalledWith("tag-1", 1);
    expect(pans.disconnect).toHaveBeenCalledWith("tag-1");
  });

  test("configureAnchorNode patches anchor options and persisted position", async () => {
    const position = { xMeters: 1, yMeters: 2, zMeters: 3, quality: 90 };

    await expect(
      configureAnchorNode("anchor-1", {
        initiator: true,
        uwbMode: "passive",
        ledEnabled: false,
        firmwareUpdateEnabled: true,
        persistedPosition: position,
        panId: 0x4567,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(pans.patchOperationMode).toHaveBeenCalledWith("anchor-1", {
      role: "anchor",
      uwbMode: "passive",
      ledEnabled: false,
      firmwareUpdateEnabled: true,
      initiatorEnabled: true,
      lowPowerModeEnabled: false,
      locationEngineEnabled: false,
    });
    expect(pans.writeNetworkId).toHaveBeenCalledWith("anchor-1", 0x4567);
    expect(pans.writePersistedPosition).toHaveBeenCalledWith(
      "anchor-1",
      position,
    );
  });

  test("observeTagAnchors collects low IDs without reading anchor-list", async () => {
    pans.readLocationData
      .mockResolvedValueOnce({
        distances: [
          {
            nodeId: 0x0002,
            anchorKey: "uwb-anchor-0002",
            distanceMeters: 1,
            quality: 90,
          },
          {
            nodeId: 0x0001,
            anchorKey: "uwb-anchor-0001",
            distanceMeters: 1,
            quality: 90,
          },
        ],
        raw: [],
        diagnostics: [],
      })
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({
        distances: [
          {
            nodeId: 0x0002,
            anchorKey: "uwb-anchor-0002",
            distanceMeters: 1,
            quality: 90,
          },
        ],
        raw: [],
        diagnostics: [],
      });

    const result = await observeTagAnchors("tag-1", {
      sampleReads: 3,
      readIntervalMs: 0,
    });

    expect(result).toEqual({
      ok: true,
      nodeIds: [1, 2],
      anchorKeys: ["uwb-anchor-0001", "uwb-anchor-0002"],
    });
    expect(pans.readAnchorList).not.toHaveBeenCalled();
    expect(pans.disconnect).toHaveBeenCalledWith("tag-1");
  });

  test("readAnchorNeighbors preserves full IDs and low-ID helper is explicit", async () => {
    pans.readAnchorList.mockResolvedValue({
      anchors: [{ nodeIdHex: "0123456789abcdef", lowNodeId: 0xcdef }],
      raw: [],
      diagnostics: [],
    });

    await expect(readAnchorNeighbors("anchor-1")).resolves.toEqual({
      ok: true,
      value: [{ nodeIdHex: "0123456789abcdef", lowNodeId: 0xcdef }],
    });
    await expect(readAnchorNeighborLowIds("anchor-1")).resolves.toEqual({
      ok: true,
      value: [0xcdef],
    });
  });
});
