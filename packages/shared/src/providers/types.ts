import { RawBeaconData } from "../types/BeaconProtocol";
import { LocalizationObservation } from "../localization/types";

export type BeaconSourceKind = "auto" | "kbeacon" | "pans-ble";

export interface BeaconSourceSubscription {
  remove(): void;
}

export interface BeaconSource {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  subscribe(
    listener: (event: BeaconSourceEvent) => void,
  ): BeaconSourceSubscription;
  destroy?(): void;
}

export interface BeaconSourceEvent {
  rawBeacons?: RawBeaconData[];
  observations?: LocalizationObservation[];
}
