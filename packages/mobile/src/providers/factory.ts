import { createKBeaconSource } from "./KBeaconSource";
import { createPansBleSource, PansBleSourceOptions } from "./PansBleSource";
import { createAutoBeaconSource } from "./AutoSource";
import { BeaconSource, BeaconSourceKind } from "./types";

export interface BeaconSourceFactoryOptions {
  pans?: PansBleSourceOptions;
}

export function createBeaconSource(
  kind: BeaconSourceKind = "auto",
  options: BeaconSourceFactoryOptions = {},
): BeaconSource {
  if (kind === "auto") return createAutoBeaconSource(options);
  if (kind === "pans-ble") return createPansBleSource(options.pans);

  return createKBeaconSource();
}
