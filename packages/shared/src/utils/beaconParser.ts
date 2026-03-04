/**
 * Beacon UID byte-structure (parsing notes)
 *
 * This parser expects the beacon UID layout described below. The app merges
 * information by MAC address since beacons rotate advertisement slots.
 *
 * Slot 0 - Identity (NID = APP_NAMESPACE, SID = 6 bytes):
 *   SID[0] = 0x01 (Identity)
 *   SID[1] = Flags
 *       bit0 (0x01): Configured
 *       bit1 (0x02): Password Protected
 *       bit2 (0x04): Password Is Serial Hash
 *       bits 3-7: reserved
 *   SID[2] = TxPower (signed int8, dBm)
 *   SID[3..5] = padding (0x00)
 *
 * Slot 1 - Position (NID = 10 bytes, SID = 6 bytes):
 *   NID[0..3] = X as UInt32 (percent of field width: 0 -> 0.0%, 4294967295 -> 100.0%)
 *   NID[4..7] = Y as UInt32 (percent of field length)
 *   NID[8..9] = Z as Int16 (centimeters)
 *   SID[0] = 0x02 (Position)
 *   SID[1..5] = padding
 *
 * Notes:
 * - Endianness: big-endian (network byte order) for multi-byte fields.
 * - Percent decode: percent = uint32 / 4294967295 * 100
 * - Z is signed centimeters; convert Int16 sign properly.
 * - The parser only treats NID as APP_NAMESPACE for identity slot; position slot's NID
 *   contains encoded X/Y/Z and therefore will not equal the APP_NAMESPACE string.
 */

import {
  APP_NAMESPACE,
  PacketType,
  BeaconState,
  RawBeaconData,
} from "../types/BeaconProtocol";

// Helper to convert hex string "0x..." to Buffer/Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper to convert ASCII string to hex string (for namespace check)
function asciiToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "0x" + hex.toUpperCase();
}

const NAMESPACE_HEX = asciiToHex(APP_NAMESPACE);

export function parseBeaconData(
  raw: RawBeaconData,
  existingState?: BeaconState,
): BeaconState {
  const newState: BeaconState = existingState
    ? { ...existingState, lastSeen: Date.now(), rssi: raw.rssi }
    : { mac: raw.mac, lastSeen: Date.now(), rssi: raw.rssi };

  for (const packet of raw.advPackets) {
    // Check for Eddystone-UID (advType usually 0 for UID in some libs, but check KBeacon types)
    // Based on ExpoKBeaconProModule.kt, KBAdvPacketEddyUID has nid and sid.
    if (packet.nid && packet.sid) {
      const nid = packet.nid;
      const sid = packet.sid;

      // Parse Identity Packet (Slot 0)
      // Namespace must match APP_NAMESPACE
      if (nid.toLowerCase() === NAMESPACE_HEX.toLowerCase()) {
        const sidBytes = hexToBytes(sid);
        if (sidBytes.length >= 6 && sidBytes[0] === PacketType.Identity) {
          const flagsByte = sidBytes[1];
          const txPowerByte = sidBytes[2]; // Signed Int8

          // Convert unsigned byte to signed int8 for TxPower
          const txPower = (txPowerByte << 24) >> 24;

          newState.identity = {
            type: PacketType.Identity,
            flags: {
              isConfigured: (flagsByte & 0x01) !== 0,
              isPasswordProtected: (flagsByte & 0x02) !== 0,
              isPasswordSerialHash: (flagsByte & 0x04) !== 0,
            },
            txPower: txPower,
          };
        }
      }

      // Parse Position Packet (Slot 1)
      // We identify this by the Packet Type in SID Byte 0, regardless of NID content
      // (Since NID holds X/Y/Z data, it won't match APP_NAMESPACE)
      const sidBytes = hexToBytes(sid);
      if (sidBytes.length >= 6 && sidBytes[0] === PacketType.Position) {
        const nidBytes = hexToBytes(nid);
        if (nidBytes.length >= 10) {
          // NID Layout:
          // Bytes 0-3: X (UInt32)
          // Bytes 4-7: Y (UInt32)
          // Bytes 8-9: Z (Int16)

          // Use this manual combination to obtain full unsigned 32-bit values (avoid sign issues)
          const xVal =
            nidBytes[0] * 16777216 +
            nidBytes[1] * 65536 +
            nidBytes[2] * 256 +
            nidBytes[3];

          const yVal =
            nidBytes[4] * 16777216 +
            nidBytes[5] * 65536 +
            nidBytes[6] * 256 +
            nidBytes[7];

          // Z is Int16 (signed)
          const zVal = (nidBytes[8] << 8) | nidBytes[9];
          const zCm = (zVal << 16) >> 16; // Sign extension

          // Convert to percentages
          const MAX_UINT32 = 4294967295;
          const xPercent = (xVal / MAX_UINT32) * 100;
          const yPercent = (yVal / MAX_UINT32) * 100;

          newState.position = {
            type: PacketType.Position,
            xPercent,
            yPercent,
            zCm,
          };
        }
      }
    }
  }

  return newState;
}
