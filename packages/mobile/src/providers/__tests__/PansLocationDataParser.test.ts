import {
  locationFrameToObservations,
  parseAnchorListPayload,
  parsePansLocationDataPayload,
} from "../PansLocationDataParser";
import { clonePansLocationDataFixture } from "expo-pans-ble-api";

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
    const frame = parsePansLocationDataPayload(
      clonePansLocationDataFixture("positionOnly14"),
    );

    const observations = locationFrameToObservations("tag-1", frame, 123);

    expect(observations[0]).toMatchObject({
      mac: "tag-1",
      observedAtMs: 123,
      measurementKind: "position",
      positionXMeters: 1,
      positionYMeters: -2,
      positionZMeters: 3,
      quality: 77,
    });
  });

  test("adapts distance observations with anchor keys", () => {
    const frame = parsePansLocationDataPayload(
      clonePansLocationDataFixture("distanceOnlyOneAnchor"),
    );

    expect(locationFrameToObservations("tag-1", frame, 123)[0]).toMatchObject({
      mac: "uwb-anchor-1234",
      distanceMeters: 1,
      quality: 90,
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
