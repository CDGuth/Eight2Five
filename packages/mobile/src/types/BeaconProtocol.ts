export const APP_NAMESPACE = "Eight2Five"; // 10 bytes: 0x45696768743246697665

export enum PacketType {
  Identity = 0x01,
  Position = 0x02,
}

export interface IdentityFlags {
  isConfigured: boolean;
  isPasswordProtected: boolean;
  isPasswordSerialHash: boolean;
}

export interface IdentityPacket {
  type: PacketType.Identity;
  flags: IdentityFlags;
  txPower: number; // dBm
}

export interface PositionPacket {
  type: PacketType.Position;
  xPercent: number; // 0.0 - 100.0
  yPercent: number; // 0.0 - 100.0
  zCm: number; // Centimeters
}

export interface BeaconState {
  mac: string;
  lastSeen: number;
  identity?: IdentityPacket;
  position?: PositionPacket;
  rssi: number;
}

export interface RawBeaconData {
  mac: string;
  rssi: number;
  advPackets: {
    advType: number;
    nid?: string;
    sid?: string;
    [key: string]: any;
  }[];
}
