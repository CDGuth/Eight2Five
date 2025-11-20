import { parseBeaconData } from "../beaconParser";
import { APP_NAMESPACE, RawBeaconData } from "../../types/BeaconProtocol";

const MAX_UINT32 = 4294967295;

function asciiToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "0x" + hex.toUpperCase();
}

function encodePercent(percent: number): number {
  return Math.round((percent / 100) * MAX_UINT32);
}

function numberToHex(value: number, bytes: number): string {
  const normalized = value >>> 0; // handle signed inputs like txPower when limited to <= 4 bytes
  return normalized.toString(16).padStart(bytes * 2, "0");
}

describe("parseBeaconData", () => {
  const namespaceHex = asciiToHex(APP_NAMESPACE);

  function buildIdentityPacket(flags: number, txPower: number) {
    const sidBytes = [0x01, flags, txPower & 0xff, 0x00, 0x00, 0x00];
    const sid =
      "0x" +
      sidBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return sid;
  }

  function buildPositionPacket(
    xPercent: number,
    yPercent: number,
    zCm: number,
  ) {
    const xHex = numberToHex(encodePercent(xPercent), 4);
    const yHex = numberToHex(encodePercent(yPercent), 4);
    const normalizedZ = ((zCm < 0 ? zCm & 0xffff : zCm) & 0xffff)
      .toString(16)
      .padStart(4, "0");
    const nid = "0x" + xHex + yHex + normalizedZ;
    const sidBytes = [0x02, 0x00, 0x00, 0x00, 0x00, 0x00];
    const sid =
      "0x" +
      sidBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return { nid, sid };
  }

  it("parses identity and position packets into beacon state", () => {
    const identityPacket = {
      advType: 2,
      nid: namespaceHex,
      sid: buildIdentityPacket(0x07, -59),
    };

    const positionPacket = {
      advType: 2,
      ...buildPositionPacket(25, 75, 183),
    };

    const raw: RawBeaconData = {
      mac: "AA:BB:CC:DD:EE:FF",
      rssi: -60,
      advPackets: [identityPacket, positionPacket],
    };

    const state = parseBeaconData(raw);

    expect(state.mac).toBe(raw.mac);
    expect(state.identity).toBeDefined();
    expect(state.identity?.flags).toEqual({
      isConfigured: true,
      isPasswordProtected: true,
      isPasswordSerialHash: true,
    });
    expect(state.identity?.txPower).toBe(-59);

    expect(state.position).toBeDefined();
    expect(state.position?.xPercent).toBeCloseTo(25, 5);
    expect(state.position?.yPercent).toBeCloseTo(75, 5);
    expect(state.position?.zCm).toBe(183);
  });

  it("retains existing identity data when only position packets arrive later", () => {
    const identityPacket = {
      advType: 2,
      nid: namespaceHex,
      sid: buildIdentityPacket(0x01, -50),
    };

    const stateWithIdentity = parseBeaconData({
      mac: "11:22:33:44:55:66",
      rssi: -65,
      advPackets: [identityPacket],
    });

    const positionPacket = buildPositionPacket(60, 40, -120);
    const updatedState = parseBeaconData(
      {
        mac: "11:22:33:44:55:66",
        rssi: -70,
        advPackets: [{ advType: 2, ...positionPacket }],
      },
      stateWithIdentity,
    );

    expect(updatedState.identity).toEqual(stateWithIdentity.identity);
    expect(updatedState.position).toBeDefined();
    expect(updatedState.position?.xPercent).toBeCloseTo(60, 5);
    expect(updatedState.position?.yPercent).toBeCloseTo(40, 5);
    expect(updatedState.position?.zCm).toBe(-120);
  });

  it("ignores UID packets whose namespace does not match the app namespace", () => {
    const raw: RawBeaconData = {
      mac: "FA:KE:BE:AC:ON:01",
      rssi: -72,
      advPackets: [
        {
          advType: 2,
          nid: "0x00000000000000000000",
          sid: buildIdentityPacket(0x01, -55),
        },
      ],
    };

    const state = parseBeaconData(raw);
    expect(state.identity).toBeUndefined();
  });
});
