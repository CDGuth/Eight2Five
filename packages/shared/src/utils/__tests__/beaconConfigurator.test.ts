import {
  generateBeaconConfig,
  buildBeaconConfigurationPlan,
  applyBeaconConfiguration,
  BeaconConfigurationTransport,
} from "../beaconConfigurator";
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

function findSlot(configs: any[], slotIndex: number) {
  return configs.find((cfg: any) => cfg.slotIndex === slotIndex);
}

describe("generateBeaconConfig", () => {
  it("builds slot 0 identity packet with expected namespace and flags", () => {
    const configs = generateBeaconConfig({
      xPercent: 0,
      yPercent: 0,
      zCm: 0,
      txPower: 4,
      isPasswordProtected: true,
      isPasswordSerialHash: false,
      isConfigured: true,
    }) as any[];

    const slot0 = findSlot(configs, 0);
    if (!slot0) throw new Error("Slot 0 config missing");

    expect(slot0.slotIndex).toBe(0);
    expect(slot0.advType).toBe(2);
    expect(slot0.nid).toBe(asciiToHex(APP_NAMESPACE));

    const sidBytes = hexToBytes(slot0.sid);
    expect(sidBytes).toHaveLength(6);
    expect(sidBytes[0]).toBe(0x01); // Packet type
    expect(sidBytes[1] & 0x01).toBe(0x01); // Configured set
    expect(sidBytes[1] & 0x02).toBe(0x02); // Password protected set
    expect(sidBytes[1] & 0x04).toBe(0x00); // Serial hash flag off

    const refPowerCfg = configs.find(
      (cfg: any) => typeof cfg.refPower1Meters === "number",
    );
    if (!refPowerCfg) throw new Error("Reference RSSI config missing");
    expect(refPowerCfg.refPower1Meters).toBe(-55);
    expect(sidBytes[2]).toBe((4 & 0xff) >>> 0);
  });

  it("encodes high precision position and clamps Z range", () => {
    const configs = generateBeaconConfig({
      xPercent: 37.1234,
      yPercent: 84.9876,
      zCm: 40000, // exceeds int16, should clamp to 32767
      txPower: -40,
      isPasswordProtected: false,
      isPasswordSerialHash: true,
      isConfigured: true,
    }) as any[];

    const slot1 = findSlot(configs, 1);
    if (!slot1) throw new Error("Slot 1 config missing");

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

  it("omits configured flag when requested", () => {
    const configs = generateBeaconConfig({
      xPercent: 5,
      yPercent: 5,
      zCm: 0,
      txPower: 8,
      isPasswordProtected: false,
      isPasswordSerialHash: false,
      isConfigured: false,
    }) as any[];

    const slot0 = findSlot(configs, 0);
    if (!slot0) throw new Error("Slot 0 config missing");

    const sidBytes = hexToBytes(slot0.sid);
    expect(sidBytes[1] & 0x01).toBe(0x00);
  });

  it("builds configuration plan with staged transitions", () => {
    const plan = buildBeaconConfigurationPlan({
      finalPosition: { xPercent: 42, yPercent: 58, zCm: 125 },
      txPower: -8,
      isPasswordProtected: false,
      isPasswordSerialHash: true,
    });

    const provisionalIdentity = findSlot(plan.provisional, 0);
    if (!provisionalIdentity) throw new Error("Provisional identity missing");
    const provisionalFlags = hexToBytes(provisionalIdentity.sid)[1];
    expect(provisionalFlags & 0x01).toBe(0x00);

    const finalizedIdentity = findSlot(plan.finalized, 0);
    if (!finalizedIdentity) throw new Error("Final identity missing");
    const finalizedFlags = hexToBytes(finalizedIdentity.sid)[1];
    expect(finalizedFlags & 0x01).toBe(0x01);

    const provisionalPosition = findSlot(plan.provisional, 1);
    if (!provisionalPosition) throw new Error("Provisional position missing");
    const provisionalPosBytes = hexToBytes(provisionalPosition.nid);
    expect(provisionalPosBytes.every((byte) => byte === 0)).toBe(true);
  });

  it("applies provisional stage using provided transport", async () => {
    const mockTransport: BeaconConfigurationTransport = {
      connect: jest.fn(async () => true),
      modifyConfig: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
    };

    const result = await applyBeaconConfiguration(
      {
        macAddress: "AA:BB:CC:DD:EE:FF",
        txPower: 4,
        isPasswordProtected: true,
        isPasswordSerialHash: false,
        finalPosition: { xPercent: 10, yPercent: 15, zCm: 50 },
      },
      mockTransport,
    );

    expect(mockTransport.connect).toHaveBeenCalledWith(
      "AA:BB:CC:DD:EE:FF",
      undefined,
      undefined,
    );
    expect(mockTransport.modifyConfig).toHaveBeenCalledTimes(1);
    expect(mockTransport.disconnect).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
    expect(result.provisionalApplied).toBe(true);
    expect(result.finalizedApplied).toBe(false);
  });

  it("applies finalized stage without managing connection when requested", async () => {
    const mockTransport: BeaconConfigurationTransport = {
      connect: jest.fn(async () => true),
      modifyConfig: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
    };

    const result = await applyBeaconConfiguration(
      {
        macAddress: "11:22:33:44:55:66",
        txPower: 0,
        isPasswordProtected: false,
        isPasswordSerialHash: false,
        finalPosition: { xPercent: 80, yPercent: 20, zCm: 175 },
        stage: "final",
        skipConnect: true,
        disconnectAfter: false,
      },
      mockTransport,
    );

    expect(mockTransport.connect).not.toHaveBeenCalled();
    expect(mockTransport.disconnect).not.toHaveBeenCalled();
    expect(mockTransport.modifyConfig).toHaveBeenCalledTimes(1);
    expect(result.provisionalApplied).toBe(false);
    expect(result.finalizedApplied).toBe(true);
  });
});
