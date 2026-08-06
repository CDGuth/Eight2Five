import {
  ConservativePositionFusion,
  classifyMotionActivity,
} from "../position-fusion";
import type { DeviceMotionSample } from "../device-motion";

describe("ConservativePositionFusion", () => {
  test("predicts only along recent accepted UWB velocity and stops at 500ms", () => {
    const fusion = new ConservativePositionFusion();
    fusion.setMotionSensorActive(true);

    expect(
      fusion.acceptUwb({
        position: { xMeters: 0, yMeters: 0 },
        receivedAt: 0,
      }),
    ).toMatchObject({
      position: { xMeters: 0, yMeters: 0 },
      source: "uwb",
      interpolationActive: false,
      lastUwbAt: 0,
    });
    fusion.acceptUwb({
      position: { xMeters: 1, yMeters: 0 },
      receivedAt: 1_000,
    });

    const predicted = fusion.acceptMotion(motion(1_200, 2));
    expect(predicted).toMatchObject({
      source: "motion-predicted",
      interpolationActive: true,
      freshnessMs: 200,
      lastUwbAt: 1_000,
    });
    expect(predicted?.position.xMeters).toBeCloseTo(0.78, 6);

    expect(fusion.acceptMotion(motion(1_501, 2))).toMatchObject({
      source: "prediction-expired",
      interpolationActive: false,
      freshnessMs: 501,
      position: { xMeters: 0.65, yMeters: 0 },
    });
  });

  test("stationary motion holds the last UWB fix and damps learned velocity", () => {
    const fusion = new ConservativePositionFusion();
    fusion.setMotionSensorActive(true);
    fusion.acceptUwb({
      position: { xMeters: 0, yMeters: 0 },
      receivedAt: 0,
    });
    fusion.acceptUwb({
      position: { xMeters: 1, yMeters: 0 },
      receivedAt: 1_000,
    });

    const held = fusion.acceptMotion(motion(1_100, 0));
    expect(held).toMatchObject({
      source: "stationary-hold",
      interpolationActive: false,
      position: { xMeters: 0.65, yMeters: 0 },
    });

    const resumed = fusion.acceptMotion(motion(1_200, 2));
    expect(resumed?.source).toBe("motion-predicted");
    expect(resumed?.position.xMeters).toBeCloseTo(0.676, 6);
  });

  test("rejects an implausible UWB jump instead of seeding prediction", () => {
    const fusion = new ConservativePositionFusion();
    fusion.setMotionSensorActive(true);
    fusion.acceptUwb({
      position: { xMeters: 0, yMeters: 0 },
      receivedAt: 0,
    });
    const rejected = fusion.acceptUwb({
      position: { xMeters: 10, yMeters: 0 },
      receivedAt: 1_000,
    });

    expect(rejected).toMatchObject({
      source: "stationary-hold",
      lastUwbAt: 0,
      lastUwbPosition: { xMeters: 0, yMeters: 0 },
    });
    expect(fusion.acceptMotion(motion(200, 2))).toMatchObject({
      source: "uwb",
      position: { xMeters: 0, yMeters: 0 },
      interpolationActive: false,
    });
  });

  test("accepts sustained movement after rejecting one impossible jump", () => {
    const fusion = new ConservativePositionFusion();
    fusion.acceptUwb({ position: { xMeters: 0, yMeters: 0 }, receivedAt: 0 });
    expect(
      fusion.acceptUwb({
        position: { xMeters: 10, yMeters: 0 },
        receivedAt: 1_000,
      }),
    ).toMatchObject({ lastUwbAt: 0 });
    expect(
      fusion.acceptUwb({
        position: { xMeters: 10.5, yMeters: 0 },
        receivedAt: 1_100,
      }),
    ).toMatchObject({
      source: "uwb",
      lastUwbAt: 1_100,
      position: { xMeters: 10.5, yMeters: 0 },
    });
  });

  test("a fresh UWB fix corrects a motion prediction", () => {
    const fusion = new ConservativePositionFusion();
    fusion.setMotionSensorActive(true);
    fusion.acceptUwb({ position: { xMeters: 0, yMeters: 0 }, receivedAt: 0 });
    fusion.acceptUwb({
      position: { xMeters: 1, yMeters: 0 },
      receivedAt: 1_000,
    });
    expect(fusion.acceptMotion(motion(1_200, 2))?.source).toBe(
      "motion-predicted",
    );
    expect(
      fusion.acceptUwb({
        position: { xMeters: 0.8, yMeters: 0 },
        receivedAt: 1_300,
      }),
    ).toMatchObject({
      source: "uwb",
      lastUwbAt: 1_300,
      interpolationActive: false,
    });
  });

  test("does not predict when motion is unavailable or inconclusive", () => {
    const fusion = new ConservativePositionFusion();
    fusion.setMotionSensorActive(true);
    fusion.acceptUwb({
      position: { xMeters: 0, yMeters: 0 },
      receivedAt: 0,
    });
    fusion.acceptUwb({
      position: { xMeters: 1, yMeters: 0 },
      receivedAt: 1_000,
    });

    expect(fusion.acceptMotion(motion(1_200))).toMatchObject({
      source: "uwb",
      position: { xMeters: 0.65, yMeters: 0 },
      interpolationActive: false,
    });
    fusion.setMotionSensorActive(false);
    expect(fusion.acceptMotion(motion(1_300, 2))).toMatchObject({
      source: "uwb",
      interpolationActive: false,
    });
  });

  test("classifies only conservative activity magnitudes", () => {
    expect(classifyMotionActivity(motion(1, 0))).toBe("stationary");
    expect(classifyMotionActivity(motion(1, 2))).toBe("moving");
    expect(classifyMotionActivity(motion(1))).toBe("unknown");
    expect(
      classifyMotionActivity(
        {
          receivedAt: 1,
          acceleration: null,
          rotationRate: { x: 50, y: 0, z: 0 },
        },
        "stationary",
      ),
    ).toBe("unknown");
  });
});

function motion(
  receivedAt: number,
  accelerationMagnitude?: number,
): DeviceMotionSample {
  return {
    receivedAt,
    acceleration:
      accelerationMagnitude === undefined
        ? null
        : { x: accelerationMagnitude, y: 0, z: 0 },
    rotationRate:
      accelerationMagnitude === undefined ? null : { x: 0, y: 0, z: 0 },
  };
}
