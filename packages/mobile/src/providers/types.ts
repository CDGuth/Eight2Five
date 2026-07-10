import { LocalizationObservation } from "../localization/types";

export type BeaconSourceKind = "pans-ble";

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
  observations?: LocalizationObservation[];
}
