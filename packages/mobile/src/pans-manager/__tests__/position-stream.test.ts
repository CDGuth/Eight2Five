import type {
  PansLiveSession,
  PansLocationNotification,
} from "../PansDeviceSessionManager";
import {
  normalizeTransportDeviceId,
  PansPositionStreamService,
} from "../PansPositionStreamService";

describe("PansPositionStreamService", () => {
  test("filters other devices, reports decode failures, and cleans up idempotently", async () => {
    let listener!: (event: PansLocationNotification) => void;
    const remove = jest.fn();
    const session = {
      addLocationDataListener: jest.fn((next) => {
        listener = next;
        return { remove };
      }),
      subscribeLocationData: jest.fn(async () => true),
      unsubscribeLocationData: jest.fn(async () => true),
      readLocationData: jest.fn(async () => ({
        distances: [],
        raw: [],
        diagnostics: [],
      })),
      decodeLocationData: jest.fn((payload: number[]) => {
        if (payload[0] === 99) throw new Error("bad bytes");
        return {
          position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 80 },
          distances: [],
          raw: payload,
          diagnostics: [],
        };
      }),
      close: jest.fn(async () => undefined),
    } as unknown as PansLiveSession;
    const sessions = {
      openLiveSession: jest.fn(async () => session),
    };
    const samples = jest.fn();
    const diagnostics = jest.fn();
    const service = new PansPositionStreamService(sessions as never, () => 42);

    await service.start({
      deviceId: "managed-tag",
      transportDeviceId: "transport-tag",
      onSample: samples,
      onDiagnostic: diagnostics,
    });
    listener({ transportDeviceId: "other", payload: [1] });
    listener({ transportDeviceId: "transport-tag", payload: [99] });
    listener({ transportDeviceId: "transport-tag", payload: [2] });

    expect(samples).toHaveBeenCalledTimes(1);
    expect(samples).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "managed-tag",
        source: "notification",
        receivedAt: 42,
      }),
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.stringContaining("decode failed"),
    );

    await Promise.all([service.stop(), service.stop()]);
    await service.stop();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(session.unsubscribeLocationData).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  test("normalizes transport IDs, preserves native metadata, and reports stage counters", async () => {
    let listener!: (event: PansLocationNotification) => void;
    const readLocationData = jest.fn(async () => ({
      distances: [],
      raw: [],
      diagnostics: [],
      decoderDiagnostics: [],
    }));
    const subscribeLocationData = jest.fn(async () => true);
    const requestMtu = jest.fn(async () => 247);
    const session = {
      addLocationDataListener: jest.fn((next) => {
        listener = next;
        return { remove: jest.fn() };
      }),
      requestMtu,
      readLocationData,
      subscribeLocationData,
      unsubscribeLocationData: jest.fn(async () => true),
      decodeLocationData: jest.fn((payload: number[]) => ({
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 80 },
        distances: [],
        raw: payload,
        diagnostics: [],
        decoderDiagnostics: [],
      })),
      close: jest.fn(async () => undefined),
    } as unknown as PansLiveSession;
    const samples = jest.fn();
    const counters = jest.fn();
    const service = new PansPositionStreamService({
      openLiveSession: jest.fn(async () => session),
    } as never);

    await service.start({
      deviceId: "tag",
      transportDeviceId: "AA:BB:CC:DD:EE:FF",
      onSample: samples,
      onCounters: counters,
    });
    listener({
      transportDeviceId: "aa-bb-cc-dd-ee-ff",
      payload: [1, 2],
      sequence: 40,
      monotonicTimestampMs: 1234.5,
      payloadLength: 2,
    });
    listener({
      transportDeviceId: "AABBCCDDEEFF",
      payload: [3, 4],
      sequence: 42,
      monotonicTimestampMs: 1235.5,
      payloadLength: 2,
    });

    expect(normalizeTransportDeviceId("aa-bb-cc-dd-ee-ff")).toBe(
      "AABBCCDDEEFF",
    );
    expect(requestMtu).toHaveBeenCalledWith(247);
    expect(requestMtu.mock.invocationCallOrder[0]).toBeLessThan(
      readLocationData.mock.invocationCallOrder[0],
    );
    expect(readLocationData.mock.invocationCallOrder[0]).toBeLessThan(
      subscribeLocationData.mock.invocationCallOrder[0],
    );
    expect(samples).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nativeSequence: 42,
        nativeMonotonicTimestampMs: 1235.5,
        payloadLength: 2,
        decoderDiagnostics: [],
      }),
    );
    expect(counters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        notificationEvents: 2,
        matchingDeviceNotifications: 2,
        decodedFrames: 3,
        positionFrames: 2,
        emittedSamples: 2,
        nativeSequenceDiscontinuities: 1,
        negotiatedMtu: 247,
      }),
    );

    await service.stop();
  });

  test("cleans up when notification subscription is rejected", async () => {
    const session = {
      addLocationDataListener: jest.fn(() => ({ remove: jest.fn() })),
      subscribeLocationData: jest.fn(async () => false),
      unsubscribeLocationData: jest.fn(async () => true),
      close: jest.fn(async () => undefined),
    } as unknown as PansLiveSession;
    const service = new PansPositionStreamService({
      openLiveSession: jest.fn(async () => session),
    } as never);

    await expect(
      service.start({
        deviceId: "tag",
        transportDeviceId: "transport",
        onSample: jest.fn(),
      }),
    ).rejects.toMatchObject({ code: "GATT_FAILURE" });
    expect(session.unsubscribeLocationData).toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
  });

  test("closes the session when listener registration fails", async () => {
    const close = jest.fn(async () => undefined);
    const session = {
      addLocationDataListener: jest.fn(() => {
        throw new Error("listener unavailable");
      }),
      close,
    } as unknown as PansLiveSession;
    const service = new PansPositionStreamService({
      openLiveSession: jest.fn(async () => session),
    } as never);

    await expect(
      service.start({
        deviceId: "tag",
        transportDeviceId: "transport",
        onSample: jest.fn(),
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("continues unsubscribe and close when listener removal throws", async () => {
    const diagnostics = jest.fn();
    const session = {
      addLocationDataListener: jest.fn(() => ({
        remove: () => {
          throw new Error("remove failed");
        },
      })),
      subscribeLocationData: jest.fn(async () => true),
      unsubscribeLocationData: jest.fn(async () => true),
      readLocationData: jest.fn(async () => ({
        distances: [],
        raw: [],
        diagnostics: [],
      })),
      close: jest.fn(async () => undefined),
    } as unknown as PansLiveSession;
    const service = new PansPositionStreamService({
      openLiveSession: jest.fn(async () => session),
    } as never);
    await service.start({
      deviceId: "tag",
      transportDeviceId: "transport",
      onSample: jest.fn(),
      onDiagnostic: diagnostics,
    });

    await service.stop();
    expect(session.unsubscribeLocationData).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.stringContaining("listener cleanup failed"),
    );
  });
});
