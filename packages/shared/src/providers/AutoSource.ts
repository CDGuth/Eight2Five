import { createKBeaconSource } from "./KBeaconSource";
import { createPansBleSource } from "./PansBleSource";
import { BeaconSource } from "./types";
import type { BeaconSourceFactoryOptions } from "./factory";

const PANS_ACTIVE_STALE_MS = 5000;

export function createAutoBeaconSource(
  options: BeaconSourceFactoryOptions = {},
): BeaconSource {
  const kbeaconSource = createKBeaconSource();
  const pansSource = createPansBleSource(options.pans);

  let pansSeenAt = 0;

  return {
    start() {
      safelyRun(() => kbeaconSource.start());
      safelyRun(() => pansSource.start());
    },
    stop() {
      safelyRun(() => kbeaconSource.stop());
      safelyRun(() => pansSource.stop());
    },
    subscribe(listener) {
      const kbeaconSubscription = safelySubscribe(kbeaconSource, (event) => {
        if (isPansActive(pansSeenAt)) {
          return;
        }

        listener(event);
      });

      const pansSubscription = safelySubscribe(pansSource, (event) => {
        if ((event.observations?.length ?? 0) > 0) {
          pansSeenAt = Date.now();
        }
        listener(event);
      });

      return {
        remove() {
          kbeaconSubscription.remove();
          pansSubscription.remove();
        },
      };
    },
    destroy() {
      safelyRun(() => kbeaconSource.destroy?.());
      safelyRun(() => pansSource.destroy?.());
    },
  };
}

function isPansActive(pansSeenAt: number) {
  return Date.now() - pansSeenAt <= PANS_ACTIVE_STALE_MS;
}

function safelySubscribe(
  source: BeaconSource,
  listener: Parameters<BeaconSource["subscribe"]>[0],
) {
  try {
    return source.subscribe(listener);
  } catch {
    return {
      remove() {},
    };
  }
}

function safelyRun(action: () => unknown) {
  try {
    action();
  } catch {
    // Best effort for optional provider behavior.
  }
}
