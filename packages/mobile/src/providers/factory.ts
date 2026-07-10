import { createPansBleSource, PansBleSourceOptions } from "./PansBleSource";
import { BeaconSource, BeaconSourceKind } from "./types";

export interface BeaconSourceFactoryOptions {
  pans?: PansBleSourceOptions;
  onError?: (error: unknown, sourceKind: BeaconSourceKind) => void;
}

export function createBeaconSource(
  kind: BeaconSourceKind = "pans-ble",
  options: BeaconSourceFactoryOptions = {},
): BeaconSource {
  const source = createPansBleSource(options.pans);

  if (options.onError) {
    const userOnError = options.onError;
    return {
      async start() {
        try {
          await source.start();
        } catch (error) {
          userOnError(error, kind);
          throw error;
        }
      },
      stop() {
        source.stop();
      },
      subscribe(listener) {
        return source.subscribe(listener);
      },
      destroy() {
        source.destroy?.();
      },
    };
  }

  return source;
}
