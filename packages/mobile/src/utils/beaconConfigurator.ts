/**
 * Beacon UID byte-structure
 *
 * Overview:
 * - We use Eddystone-UID slots to broadcast identity and high-precision position.
 * - Slot 0: Identity (NID = APP_NAMESPACE (ASCII "Eight2Five"), SID = 6 bytes)
 * - Slot 1: Position (NID = 10 bytes containing X,Y,Z encoded; SID = 6 bytes)
 * - The app stores field associations by MAC; beacons do NOT store field associations.
 *
 * Endianness: big-endian (network byte order) for multi-byte integer fields.
 *
 * Slot 0 - Identity (NID = APP_NAMESPACE, SID = 6 bytes)
 *   SID bytes (byte indices in parentheses):
 *     [0] Packet Type = 0x01 (Identity)
 *     [1] Flags
 *          bit0 (0x01): Configured (1) / Unconfigured (0)
 *          bit1 (0x02): Password Protected flag (1 = beacon requires password to modify)
 *          bit2 (0x04): Password Is Serial Hash (1 = low-security password derived from serial)
 *          bits 3-7: reserved (0)
 *     [2] Tx Power (signed int8, dBm) - reference transmit power for distance estimation
 *     [3..5] Padding (0x00) - reserved for future use
 *
 * Notes:
 * - The beacon NEVER broadcasts the password itself. If PasswordIsSerialHash flag is set,
 *   the app can derive the low-security password by extracting the first 4 bytes of the
 *   SHA-256 hash of the serial number (format expected by the beacon: hex string prefixed with '0x').
 *   This method of relies on physical access control of the serial number rather than cryptography,
 *   hence the lower security.
 * - The app may also instead set a custom password (or no password) locally via BLE when configuring.
 *
 * Slot 1 - Position (NID = 10 bytes, SID = 6 bytes)
 *   NID bytes (10 bytes total):
 *     [0..3] X coordinate as UInt32: encodes percent across field width (0.0% -> 0, 100.0% -> 4294967295)
 *     [4..7] Y coordinate as UInt32: encodes percent across field length (same scale as X)
 *     [8..9] Z coordinate as Int16: height in CENTIMETERS (signed) range: -32768 .. 32767 (±327.67 m)
 *   SID bytes (6 bytes total):
 *     [0] Packet Type = 0x02 (Position)
 *     [1..5] Padding (0x00) - reserved for future use
 *
 * Encoding / decoding formulas:
 *   encodeX(percentX) -> uint32 = round(percentX/100 * 4294967295)
 *   decodeX(uint32) -> percentX = uint32 / 4294967295 * 100
 *   Z stored directly as signed Int16 representing centimeters (e.g., 183 cm -> 0x00B7)
 *
 * Rationale:
 * - Using 32-bit precision for X/Y (percentage) gives very fine fractional accuracy while keeping values
 *   independent of absolute field dimensions (app converts percent -> meters using field size)
 * - Z in centimeters meets the requirement for at least 2-byte height precision
 * - TxPower in identity slot provides a single-byte reference power for client-side distance models
 * - Flags allow the beacon to advertise whether it is password protected and whether that
 *   password should be derived from the device serial (low-security) or is a custom password
 *
 * Implementation notes:
 * - The app must merge incoming UID slots by MAC address since Eddystone slots rotate and
 *   different packets may be observed at different times.
 * - Do NOT broadcast passwords; password flags only indicate the presence and type of protection.
 */

import { APP_NAMESPACE, PacketType } from "../types/BeaconProtocol";
import {
  KBCfgBase,
  KBCfgCommon,
} from "../../../../modules/expo-kbeaconpro/src/ExpoKBeaconPro.types";

const TX_POWER_TO_REF_RSSI = new Map<number, number>([
  [8, -51],
  [4, -55],
  [0, -59],
  [-4, -63],
  [-8, -67],
  [-12, -71],
  [-16, -75],
  [-20, -79],
  [-40, -99],
]);

function resolveRefPower(txPower: number): number | undefined {
  return TX_POWER_TO_REF_RSSI.get(txPower);
}

// Helper to convert number to hex string with padding
function toHex(num: number, bytes: number): string {
  let hex = "";
  if (bytes <= 4) {
    // Standard JS bitwise operations work on 32-bit signed integers
    // For unsigned handling or larger numbers, we need care.
    // Here we assume inputs fit in the byte range.
    // Handle negative numbers for signed bytes (2's complement)
    if (num < 0) {
      num = num >>> 0; // This only works for 32-bit numbers
      // For smaller widths, we mask manually
      const mask = Math.pow(2, bytes * 8) - 1;
      num = num & mask;
    }
    hex = num.toString(16).padStart(bytes * 2, "0");
  } else {
    // For larger numbers (like 64-bit), we'd need BigInt, but we don't use >4 bytes here per field
    hex = num.toString(16).padStart(bytes * 2, "0");
  }
  return hex;
}

function asciiToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export interface BeaconPosition {
  xPercent: number;
  yPercent: number;
  zCm: number;
}

export interface BeaconIdentitySettings {
  txPower: number;
  isPasswordProtected: boolean;
  isPasswordSerialHash: boolean;
}

const DEFAULT_POSITION: BeaconPosition = {
  xPercent: 0,
  yPercent: 0,
  zCm: 0,
};

function normalizePosition(position?: BeaconPosition): BeaconPosition {
  if (!position) return { ...DEFAULT_POSITION };
  return {
    xPercent: clamp(position.xPercent, 0, 100),
    yPercent: clamp(position.yPercent, 0, 100),
    zCm: clamp(position.zCm, -32768, 32767),
  };
}

export interface BeaconConfigParams
  extends BeaconPosition, BeaconIdentitySettings {
  isConfigured?: boolean;
}

export type BeaconConfigurationStage = "provisional" | "final" | "all";

export interface BeaconConfigurationPlanOptions extends BeaconIdentitySettings {
  finalPosition: BeaconPosition;
  provisionalPosition?: BeaconPosition;
}

export interface BeaconConfigurationPlan {
  provisional: KBCfgBase[];
  finalized: KBCfgBase[];
}

export interface BeaconConfigurationTransport {
  connect: (
    macAddress: string,
    password?: string,
    timeout?: number,
  ) => Promise<boolean>;
  modifyConfig: (macAddress: string, configs: KBCfgBase[]) => Promise<boolean>;
  disconnect: (macAddress: string) => Promise<boolean>;
}

type NativeBeaconModule =
  typeof import("../../../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule");

let cachedTransport: BeaconConfigurationTransport | null = null;

async function getDefaultTransport(): Promise<BeaconConfigurationTransport> {
  if (cachedTransport) return cachedTransport;
  const nativeModule: NativeBeaconModule =
    await import("../../../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule");
  cachedTransport = {
    connect: nativeModule.connect,
    modifyConfig: nativeModule.modifyConfig,
    disconnect: nativeModule.disconnect,
  };
  return cachedTransport;
}

export interface ApplyBeaconConfigurationOptions extends BeaconConfigurationPlanOptions {
  macAddress: string;
  password?: string;
  timeout?: number;
  stage?: BeaconConfigurationStage;
  disconnectAfter?: boolean;
  skipConnect?: boolean;
}

export interface BeaconConfigurationResult {
  provisionalApplied: boolean;
  finalizedApplied: boolean;
  plan: BeaconConfigurationPlan;
}

export function generateBeaconConfig(params: BeaconConfigParams): KBCfgBase[] {
  const configs: any[] = []; // Using any[] because we need to cast to KBCfgAdvEddyUID which might not be fully typed in the module yet
  const isConfigured = params.isConfigured ?? false; // Default to false until configuration is completed

  // --- Slot 0: Identity ---
  // NID: APP_NAMESPACE
  // SID: [Type(1), Flags(1), TxPower(1), Padding(3)]

  const nid0 = "0x" + asciiToHex(APP_NAMESPACE);

  let flags = 0x00;
  if (isConfigured) flags |= 0x01;
  if (params.isPasswordProtected) flags |= 0x02;
  if (params.isPasswordSerialHash) flags |= 0x04;

  const txPowerByte = params.txPower & 0xff; // Ensure 1 byte

  const sid0Bytes = [
    PacketType.Identity,
    flags,
    txPowerByte,
    0x00,
    0x00,
    0x00, // Padding
  ];

  const sid0 =
    "0x" + sid0Bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

  configs.push({
    advType: 2, // KBAdvType.EddyUID (Assuming 2, need to verify enum)
    slotIndex: 0,
    nid: nid0,
    sid: sid0,
    txPower: params.txPower,
    advPeriod: 1000.0, // 1Hz default //TODO: Check BlueCharmBeacons docs for optimal period
    advConnectable: true,
    advTriggerOnly: false,
  });

  // --- Slot 1: Position ---
  // NID: [X(4), Y(4), Z(2)]
  // SID: [Type(1), Padding(5)]

  const MAX_UINT32 = 4294967295;
  const xVal = Math.round((params.xPercent / 100) * MAX_UINT32);
  const yVal = Math.round((params.yPercent / 100) * MAX_UINT32);

  // Handle Z (Int16)
  let zVal = params.zCm;
  if (zVal < -32768) zVal = -32768;
  if (zVal > 32767) zVal = 32767;
  // Convert to 16-bit hex (handling negative)
  const zHex = (zVal & 0xffff).toString(16).padStart(4, "0");

  const xHex = toHex(xVal, 4);
  const yHex = toHex(yVal, 4);

  const nid1 = "0x" + xHex + yHex + zHex;

  const sid1Bytes = [
    PacketType.Position,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // Padding
  ];
  const sid1 =
    "0x" + sid1Bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

  configs.push({
    advType: 2, // KBAdvType.EddyUID
    slotIndex: 1,
    nid: nid1,
    sid: sid1,
    txPower: params.txPower,
    advPeriod: 1000.0, //TODO: Check BlueCharmBeacons docs for optimal period
    advConnectable: true,
    advTriggerOnly: false,
  });

  const refPower1m = resolveRefPower(params.txPower);
  if (typeof refPower1m === "number") {
    configs.push({
      refPower1Meters: refPower1m,
    } as KBCfgCommon);
  }

  return configs;
}

/**
 * Builds the full two-stage configuration (provisional + finalized) for a beacon.
 */
export function buildBeaconConfigurationPlan(
  options: BeaconConfigurationPlanOptions,
): BeaconConfigurationPlan {
  const identity: BeaconIdentitySettings = {
    txPower: options.txPower,
    isPasswordProtected: options.isPasswordProtected,
    isPasswordSerialHash: options.isPasswordSerialHash,
  };

  const provisionalParams: BeaconConfigParams = {
    ...normalizePosition(options.provisionalPosition),
    ...identity,
    isConfigured: false,
  };

  const finalParams: BeaconConfigParams = {
    ...normalizePosition(options.finalPosition),
    ...identity,
    isConfigured: true,
  };

  return {
    provisional: generateBeaconConfig(provisionalParams),
    finalized: generateBeaconConfig(finalParams),
  };
}

/**
 * Applies the requested stage of the configuration plan to a beacon.
 */
export async function applyBeaconConfiguration(
  options: ApplyBeaconConfigurationOptions,
  transport?: BeaconConfigurationTransport,
): Promise<BeaconConfigurationResult> {
  const plan = buildBeaconConfigurationPlan(options);
  const stage: BeaconConfigurationStage = options.stage ?? "provisional";
  const shouldApplyProvisional = stage === "provisional" || stage === "all";
  const shouldApplyFinal = stage === "final" || stage === "all";
  const activeTransport = transport ?? (await getDefaultTransport());

  if (!shouldApplyProvisional && !shouldApplyFinal) {
    throw new Error("Invalid configuration stage supplied");
  }

  let connected = false;
  if (!options.skipConnect) {
    const didConnect = await activeTransport.connect(
      options.macAddress,
      options.password,
      options.timeout,
    );
    if (!didConnect) {
      throw new Error(`Unable to connect to beacon ${options.macAddress}`);
    }
    connected = true;
  }

  try {
    let provisionalApplied = false;
    let finalizedApplied = false;

    if (shouldApplyProvisional) {
      provisionalApplied = await activeTransport.modifyConfig(
        options.macAddress,
        plan.provisional,
      );
      if (!provisionalApplied) {
        throw new Error(
          `Failed to apply provisional configuration to beacon ${options.macAddress}`,
        );
      }
    }

    if (shouldApplyFinal) {
      finalizedApplied = await activeTransport.modifyConfig(
        options.macAddress,
        plan.finalized,
      );
      if (!finalizedApplied) {
        throw new Error(
          `Failed to apply finalized configuration to beacon ${options.macAddress}`,
        );
      }
    }

    return { provisionalApplied, finalizedApplied, plan };
  } finally {
    if (connected && options.disconnectAfter !== false) {
      await activeTransport.disconnect(options.macAddress);
    }
  }
}
