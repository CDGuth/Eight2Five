import type { FusedPositionOutput, FieldPoint } from "@eight2five/mobile/field";
import type {
  DeviceMotionAdapter,
  DeviceMotionSample,
} from "@eight2five/mobile/motion";
import type { PansPositionStreamSample } from "@eight2five/mobile/pans-manager";
import type { SharedValue } from "react-native-reanimated";

import {
  INITIAL_MOBILE_PANS_SNAPSHOT,
  type MobilePansSnapshot,
} from "../mobile-pans-model";
import { MobilePansPositionPublisher } from "../mobile-pans-position-publisher";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock"),
);
jest.mock(
  "@shopify/react-native-skia",
  () => ({
    Canvas: () => null,
    Fill: () => null,
    Group: () => null,
    Path: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
    useFont: () => ({}),
    vec: (x: number, y: number) => ({ x, y }),
  }),
  { virtual: true },
);

describe("MobilePansPositionPublisher", () => {
  test("publishes UWB-first fused output to both shared values and HUD state", async () => {
    let snapshot: MobilePansSnapshot = {
      ...INITIAL_MOBILE_PANS_SNAPSHOT,
      connectionState: "connected",
    };
    let motionListener!: (sample: DeviceMotionSample) => void;
    const adapter: DeviceMotionAdapter = {
      start: jest.fn(async (listener) => {
        motionListener = listener;
        return "active";
      }),
      stop: jest.fn(),
    };
    const positionValue = { value: null } as SharedValue<FieldPoint | null>;
    const fusionValue = {
      value: null,
    } as SharedValue<FusedPositionOutput | null>;
    const publisher = new MobilePansPositionPublisher(
      {
        staleAfterMs: 2_500,
        schedule: setTimeout,
        cancel: clearTimeout,
        isConnectionCurrent: () => true,
        getSnapshot: () => snapshot,
        publish: (next) => {
          snapshot = next;
        },
      },
      { motionAdapter: adapter, motionInterpolationEnabled: true },
    );
    publisher.attachPositionValue(positionValue);
    publisher.attachFusionValue(fusionValue);
    await publisher.startMotion(1);

    publisher.receiveSample(positionSample(1_000, 0), 1);
    publisher.receiveSample(positionSample(2_000, 1), 1);
    motionListener({
      receivedAt: 2_200,
      acceleration: { x: 2, y: 0, z: 0 },
      rotationRate: { x: 0, y: 0, z: 0 },
    });

    expect(positionValue.value).toEqual({ xMeters: 0.78, yMeters: 0 });
    expect(fusionValue.value).toMatchObject({
      source: "motion-predicted",
      interpolationActive: true,
      freshnessMs: 200,
      lastUwbAt: 2_000,
    });
    expect(snapshot.livePosition).toMatchObject({
      position: { xMeters: 0.78, yMeters: 0 },
      source: "motion-predicted",
      interpolationActive: true,
      lastUwbPosition: { xMeters: 1, yMeters: 0 },
      lastUwbAt: 2_000,
    });
    expect(snapshot.rawPosition).toEqual({
      xMeters: 1,
      yMeters: 0,
      zMeters: 0,
    });
    publisher.setMotionInterpolationEnabled(false);
    expect(positionValue.value).toEqual({ xMeters: 1, yMeters: 0 });
    expect(fusionValue.value).toMatchObject({
      source: "uwb",
      interpolationActive: false,
      position: { xMeters: 1, yMeters: 0 },
    });
    publisher.dispose();
  });

  test("bypasses the adapter and keeps raw UWB output when the preference is off", async () => {
    let snapshot: MobilePansSnapshot = {
      ...INITIAL_MOBILE_PANS_SNAPSHOT,
      connectionState: "connected",
    };
    const adapter: DeviceMotionAdapter = {
      start: jest.fn(async () => "active"),
      stop: jest.fn(),
    };
    const fusionValue = {
      value: null,
    } as SharedValue<FusedPositionOutput | null>;
    const publisher = new MobilePansPositionPublisher(
      {
        staleAfterMs: 2_500,
        schedule: setTimeout,
        cancel: clearTimeout,
        isConnectionCurrent: () => true,
        getSnapshot: () => snapshot,
        publish: (next) => {
          snapshot = next;
        },
      },
      { motionAdapter: adapter, motionInterpolationEnabled: false },
    );
    publisher.attachFusionValue(fusionValue);

    await publisher.startMotion(1);
    publisher.receiveSample(positionSample(1_000, 5), 1);
    publisher.receiveSample(positionSample(2_000, 6), 1);

    expect(adapter.start).not.toHaveBeenCalled();
    expect(fusionValue.value).toMatchObject({
      position: { xMeters: 6, yMeters: 0 },
      source: "uwb",
      interpolationActive: false,
    });
    expect(snapshot.livePosition.interpolationActive).toBe(false);
    publisher.dispose();
  });
});

function positionSample(
  receivedAt: number,
  xMeters: number,
): PansPositionStreamSample {
  return {
    deviceId: "tag",
    transportDeviceId: "transport-tag",
    receivedAt,
    source: "notification",
    position: { xMeters, yMeters: 0, zMeters: 0, quality: 80 },
    distances: [],
    diagnostics: [],
    decoderDiagnostics: [],
  };
}
