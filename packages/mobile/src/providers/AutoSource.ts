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
  const sources = [
    { kind: "kbeacon" as const, source: kbeaconSource },
    { kind: "pans-ble" as const, source: pansSource },
  ];

  let pansSeenAt = 0;

  return {
    async start() {
      const results = await Promise.allSettled(
        sources.map(({ source }) => source.start()),
      );
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          options.onError?.(result.reason, sources[index].kind);
        }
      });

      if (failures.length === sources.length) {
        throw aggregateStartupError(failures.map((failure) => failure.reason));
      }
    },
    async stop() {
      await Promise.allSettled(
        sources.map(({ source }) =>
          Promise.resolve().then(() => source.stop()),
        ),
      );
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
      sources.forEach(({ source }) => {
        try {
          source.destroy?.();
        } catch {
          // Best effort teardown for optional providers.
        }
      });
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

function aggregateStartupError(errors: unknown[]): Error {
  if (typeof AggregateError === "function") {
    return new AggregateError(errors, "All beacon providers failed to start.");
  }

  const error = new Error("All beacon providers failed to start.");
  (error as Error & { errors?: unknown[] }).errors = errors;
  return error;
}
