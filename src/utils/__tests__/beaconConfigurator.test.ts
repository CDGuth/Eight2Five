import { generateBeaconConfig } from "../beaconConfigurator";
import { APP_NAMESPACE } from "../../types/BeaconProtocol";

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

function asciiToHex(value: string): string {
  let hex = "";
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "0x" + hex.toUpperCase();
}

describe("generateBeaconConfig", () => {
  it("builds slot 0 identity packet with expected namespace and flags", () => {
    const [slot0] = generateBeaconConfig({
      xPercent: 0,
      yPercent: 0,
      zCm: 0,
      txPower: -59,
      isPasswordProtected: true,
      isPasswordSerialHash: false,
    }) as any[];

    expect(slot0.slotIndex).toBe(0);
    expect(slot0.advType).toBe(2);
    expect(slot0.nid).toBe(asciiToHex(APP_NAMESPACE));

    const sidBytes = hexToBytes(slot0.sid);
    expect(sidBytes).toHaveLength(6);
    expect(sidBytes[0]).toBe(0x01); // Packet type
    expect(sidBytes[1] & 0x01).toBe(0x01); // Configured set
    expect(sidBytes[1] & 0x02).toBe(0x02); // Password protected set
    expect(sidBytes[1] & 0x04).toBe(0x00); // Serial hash flag off
    expect(sidBytes[2]).toBe((-59 & 0xff) >>> 0);
  });

  it("encodes high precision position and clamps Z range", () => {
    const [, slot1] = generateBeaconConfig({
      xPercent: 37.1234,
      yPercent: 84.9876,
      zCm: 40000, // exceeds int16, should clamp to 32767
      txPower: -40,
      isPasswordProtected: false,
      isPasswordSerialHash: true,
    }) as any[];

    const nidBytes = hexToBytes(slot1.nid);
    expect(nidBytes).toHaveLength(10);

    const xValue =
      nidBytes[0] * 16777216 +
      nidBytes[1] * 65536 +
      nidBytes[2] * 256 +
      nidBytes[3];
    const yValue =
      nidBytes[4] * 16777216 +
      nidBytes[5] * 65536 +
      nidBytes[6] * 256 +
      nidBytes[7];

    const MAX_UINT32 = 4294967295;
    const decodedXPercent = (xValue / MAX_UINT32) * 100;
    const decodedYPercent = (yValue / MAX_UINT32) * 100;

    expect(decodedXPercent).toBeCloseTo(37.1234, 4);
    expect(decodedYPercent).toBeCloseTo(84.9876, 4);

    // Z should be clamped to max int16 (32767)
    const zValue = (nidBytes[8] << 8) | nidBytes[9];
    const signedZ = (zValue << 16) >> 16;
    expect(signedZ).toBe(32767);

    const sidBytes = hexToBytes(slot1.sid);
    expect(sidBytes[0]).toBe(0x02);
    expect(sidBytes.slice(1)).toEqual([0, 0, 0, 0, 0]);
  });
});
