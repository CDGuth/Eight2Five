import type {
  PansLiveSession,
  PansLocationNotification,
} from "../PansDeviceSessionManager";
import { PansPositionStreamService } from "../PansPositionStreamService";
import { SyntheticPansPositionNotificationSource } from "../testing/SyntheticPansPositionNotificationSource";

describe("SyntheticPansPositionNotificationSource", () => {
  test.each([
    [1, 60],
    [10, 600],
  ] as const)(
    "emits an ordered %d Hz stream for 60 simulated seconds",
    (rateHz, expectedCount) => {
      const source = new SyntheticPansPositionNotificationSource({ rateHz });
      const events: { sequence: number; emittedAtMs: number }[] = [];
      source.addListener(({ sequence, emittedAtMs }) => {
        events.push({ sequence, emittedAtMs });
      });

      expect(source.emitForDuration(60_000)).toBe(expectedCount);
      expect(events).toHaveLength(expectedCount);
      expect(events.map(({ sequence }) => sequence)).toEqual(
        Array.from({ length: expectedCount }, (_, index) => index),
      );
      expect(
        events.every(
          (event, index) =>
            index === 0 || event.emittedAtMs > events[index - 1].emittedAtMs,
        ),
      ).toBe(true);
    },
  );

  test("delivers a five-minute 10 Hz stream through decode and sample emission without loss", async () => {
    jest.useFakeTimers();
    const source = new SyntheticPansPositionNotificationSource({
      rateHz: 10,
      transportDeviceId: "AA:BB:CC:DD:EE:FF",
    });
    const session = {
      addLocationDataListener: (
        listener: (event: PansLocationNotification) => void,
      ) => source.addListener(listener),
      readLocationData: jest.fn(async () => ({
        distances: [],
        raw: [],
        diagnostics: [],
        decoderDiagnostics: [],
      })),
      subscribeLocationData: jest.fn(async () => true),
      unsubscribeLocationData: jest.fn(async () => true),
      decodeLocationData: decodeSyntheticPosition,
      close: jest.fn(async () => undefined),
    } as unknown as PansLiveSession;
    const samples: number[] = [];
    const counterSnapshots: { emittedSamples: number }[] = [];
    const service = new PansPositionStreamService({
      openLiveSession: jest.fn(async () => session),
    } as never);

    await service.start({
      deviceId: "tag",
      transportDeviceId: "aa-bb-cc-dd-ee-ff",
      onSample: (sample) => {
        if (sample.position) samples.push(sample.nativeSequence!);
      },
      onCounters: (counters) =>
        counterSnapshots.push({ emittedSamples: counters.emittedSamples }),
    });
    expect(source.emitForDuration(5 * 60_000)).toBe(3_000);
    jest.advanceTimersByTime(250);

    expect(samples).toHaveLength(3_000);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(2_999);
    expect(service.counters).toMatchObject({
      notificationEvents: 3_000,
      matchingDeviceNotifications: 3_000,
      decodedFrames: 3_001,
      positionFrames: 3_000,
      emittedSamples: 3_000,
      decodeFailures: 0,
      nativeSequenceDiscontinuities: 0,
    });
    expect(counterSnapshots.at(-1)?.emittedSamples).toBe(3_000);
    await service.stop();
    jest.useRealTimers();
  });

  test("stops delivering after a listener is removed", () => {
    const source = new SyntheticPansPositionNotificationSource({ rateHz: 10 });
    const listener = jest.fn();
    const subscription = source.addListener(listener);

    source.emitNext();
    subscription.remove();
    source.emitNext();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.emittedCount).toBe(2);
  });
});

function decodeSyntheticPosition(payload: number[]) {
  const bytes = Uint8Array.from(payload);
  const view = new DataView(bytes.buffer);
  return {
    frameType: 0 as const,
    position: {
      xMeters: view.getInt32(1, true) / 1000,
      yMeters: view.getInt32(5, true) / 1000,
      zMeters: view.getInt32(9, true) / 1000,
      quality: bytes[13],
    },
    distances: [],
    raw: payload,
    diagnostics: [],
    decoderDiagnostics: [],
  };
}
