import { KBAdvType } from "expo-kbeaconpro";
import { parseBeaconData } from "../beaconParser";
import {
  APP_NAMESPACE,
  PacketType,
  RawBeaconData,
} from "../../types/BeaconProtocol";

jest.mock("expo-kbeaconpro", () => ({
  KBAdvType: {
    IBeacon: 0,
    EddyTLM: 1,
    EddyUID: 2,
    EddyURL: 3,
    Sensor: 4,
    System: 5,
    EBeacon: 6,
    Unknown: 255,
  },
}));

const MAX_UINT32 = 4294967295;

function asciiToHex(str: string, casing: "upper" | "lower" = "upper"): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }

  return `0x${casing === "upper" ? hex.toUpperCase() : hex.toLowerCase()}`;
}

function encodePercent(percent: number): number {
  return Math.round((percent / 100) * MAX_UINT32);
}

function numberToHex(value: number, bytes: number): string {
  return (value >>> 0).toString(16).padStart(bytes * 2, "0");
}

function buildIdentityPacket(
  flags: number,
  txPower: number,
  casing: "upper" | "lower" = "upper",
) {
  const sidBytes = [PacketType.Identity, flags, txPower & 0xff, 0, 0, 0];
  const sidHex = sidBytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    advType: KBAdvType.EddyUID,
    nid: asciiToHex(APP_NAMESPACE, casing),
    sid: `0x${casing === "upper" ? sidHex.toUpperCase() : sidHex}`,
  };
}

function buildPositionPacket(
  xPercent: number,
  yPercent: number,
  zCm: number,
  casing: "upper" | "lower" = "upper",
) {
  const xHex = numberToHex(encodePercent(xPercent), 4);
  const yHex = numberToHex(encodePercent(yPercent), 4);
  const zHex = ((zCm < 0 ? zCm & 0xffff : zCm) & 0xffff)
    .toString(16)
    .padStart(4, "0");
  const nidHex = xHex + yHex + zHex;
  const sidHex = "020000000000";

  return {
    advType: KBAdvType.EddyUID,
    nid: `0x${casing === "upper" ? nidHex.toUpperCase() : nidHex}`,
    sid: `0x${casing === "upper" ? sidHex.toUpperCase() : sidHex}`,
  };
}

function rawBeacon(
  advPackets: RawBeaconData["advPackets"],
  mac = "aa:bb:cc:dd:ee:ff",
): RawBeaconData {
  return {
    mac,
    rssi: -60,
    advPackets,
  };
}

describe("parseBeaconData", () => {
  it("parses identity slot first and position slot later", () => {
    const withIdentity = parseBeaconData(
      rawBeacon([buildIdentityPacket(0x07, -59)]),
    );
    const withPosition = parseBeaconData(
      rawBeacon([buildPositionPacket(25, 75, 183)]),
      withIdentity,
    );

    expect(withPosition.mac).toBe("AA:BB:CC:DD:EE:FF");
    expect(withPosition.identity?.flags).toEqual({
      isConfigured: true,
      isPasswordProtected: true,
      isPasswordSerialHash: true,
    });
    expect(withPosition.identity?.txPower).toBe(-59);
    expect(withPosition.position?.xPercent).toBeCloseTo(25, 5);
    expect(withPosition.position?.yPercent).toBeCloseTo(75, 5);
    expect(withPosition.position?.zCm).toBe(183);
  });

  it("parses position slot first and identity slot later", () => {
    const withPosition = parseBeaconData(
      rawBeacon([buildPositionPacket(60, 40, -120)]),
    );
    const withIdentity = parseBeaconData(
      rawBeacon([buildIdentityPacket(0x01, -50)]),
      withPosition,
    );

    expect(withIdentity.position?.xPercent).toBeCloseTo(60, 5);
    expect(withIdentity.position?.yPercent).toBeCloseTo(40, 5);
    expect(withIdentity.position?.zCm).toBe(-120);
    expect(withIdentity.identity?.flags.isConfigured).toBe(true);
    expect(withIdentity.identity?.txPower).toBe(-50);
  });

  it("merges packets by normalized MAC when existing state is provided", () => {
    const initial = parseBeaconData(
      rawBeacon([buildIdentityPacket(0x01, -55)], "aa:bb:cc:dd:ee:ff"),
    );
    const updated = parseBeaconData(
      rawBeacon([buildPositionPacket(10, 20, 30)], "AA:BB:CC:DD:EE:FF"),
      initial,
    );

    expect(updated.mac).toBe("AA:BB:CC:DD:EE:FF");
    expect(updated.identity).toEqual(initial.identity);
    expect(updated.position?.xPercent).toBeCloseTo(10, 5);
  });

  it("accepts lowercase hex", () => {
    const state = parseBeaconData(
      rawBeacon([
        buildIdentityPacket(0x01, -55, "lower"),
        buildPositionPacket(1, 2, 3, "lower"),
      ]),
    );

    expect(state.identity?.txPower).toBe(-55);
    expect(state.position?.xPercent).toBeCloseTo(1, 5);
  });

  it("accepts uppercase hex", () => {
    const state = parseBeaconData(
      rawBeacon([
        buildIdentityPacket(0x01, -55, "upper"),
        buildPositionPacket(3, 4, 5, "upper"),
      ]),
    );

    expect(state.identity?.txPower).toBe(-55);
    expect(state.position?.yPercent).toBeCloseTo(4, 5);
  });

  it("parses negative Z", () => {
    const state = parseBeaconData(
      rawBeacon([buildPositionPacket(0, 0, -32768)]),
    );

    expect(state.position?.zCm).toBe(-32768);
  });

  it("parses max X and max Y", () => {
    const state = parseBeaconData(
      rawBeacon([buildPositionPacket(100, 100, 0)]),
    );

    expect(state.position?.xPercent).toBeCloseTo(100, 5);
    expect(state.position?.yPercent).toBeCloseTo(100, 5);
  });

  it("ignores unrelated packets", () => {
    const state = parseBeaconData(
      rawBeacon([
        {
          advType: KBAdvType.IBeacon,
          nid: asciiToHex(APP_NAMESPACE),
          sid: "0x010000000000",
        },
        {
          advType: KBAdvType.EddyUID,
          nid: "0x00000000000000000000",
          sid: "0x010000000000",
        },
      ]),
    );

    expect(state.identity).toBeUndefined();
    expect(state.position).toBeUndefined();
  });

  it("handles duplicate packets safely", () => {
    const identity = buildIdentityPacket(0x01, -55);
    const position = buildPositionPacket(12, 34, 56);
    const state = parseBeaconData(
      rawBeacon([identity, identity, position, position]),
    );

    expect(state.identity?.txPower).toBe(-55);
    expect(state.position?.xPercent).toBeCloseTo(12, 5);
    expect(state.position?.yPercent).toBeCloseTo(34, 5);
    expect(state.position?.zCm).toBe(56);
  });
});
