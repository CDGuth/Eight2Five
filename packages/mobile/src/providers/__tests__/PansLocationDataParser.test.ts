import {
  locationFrameToObservations,
  parseAnchorListPayload,
  parsePansLocationDataPayload,
} from "../PansLocationDataParser";

jest.mock("expo-modules-core", () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  requireNativeModule: jest.fn(() => ({
    getCapabilities: jest.fn(() => ({
      transport: "ble",
      supportsScanning: true,
      supportsConnection: true,
      supportsNotifications: true,
      supportsMtuRequest: false,
      supportsMaximumWriteValueLength: false,
    })),
  })),
}));

describe("PansLocationDataParser", () => {
  test("adapts calculated coordinates with meters", () => {
    const frame = parsePansLocationDataPayload([
      0,
      ...i32(1500),
      ...i32(-2250),
      ...i32(750),
      80,
    ]);

    const observations = locationFrameToObservations("tag-1", frame, 123);

    expect(observations[0]).toMatchObject({
      mac: "tag-1",
      observedAtMs: 123,
      measurementKind: "position",
      positionXMeters: 1.5,
      positionYMeters: -2.25,
      positionZMeters: 0.75,
      quality: 80,
    });
  });

  test("adapts distance observations with anchor keys", () => {
    const frame = parsePansLocationDataPayload([
      1,
      1,
      0xef,
      0xcd,
      ...u32(4250),
      91,
    ]);

    expect(locationFrameToObservations("tag-1", frame, 123)[0]).toMatchObject({
      mac: "uwb-anchor-cdef",
      distanceMeters: 4.25,
      quality: 91,
    });
  });

  test("uses module codec behavior for malformed payloads and full anchor IDs", () => {
    expect(() => parsePansLocationDataPayload([9])).toThrow(
      "unknown location-data",
    );

    const anchorList = parseAnchorListPayload([
      1, 0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
    ]);

    expect(anchorList.anchors[0]).toEqual({
      nodeIdHex: "0123456789abcdef",
      lowNodeId: 0xcdef,
    });
  });
});

function i32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return Array.from(bytes);
}

function u32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return Array.from(bytes);
}
