import type { DeviceMotionMeasurement } from "expo-sensors";
import {
  DEVICE_MOTION_UPDATE_INTERVAL_MS,
  ExpoDeviceMotionAdapter,
} from "../device-motion";

describe("ExpoDeviceMotionAdapter", () => {
  test("falls back without requesting permission when the sensor is unavailable", async () => {
    const sensor = createSensor({ available: false });
    const adapter = new ExpoDeviceMotionAdapter(sensor);

    await expect(adapter.start(jest.fn())).resolves.toBe("unavailable");
    expect(sensor.getPermissionsAsync).not.toHaveBeenCalled();
    expect(sensor.addListener).not.toHaveBeenCalled();
  });

  test("falls back when permission remains denied", async () => {
    const sensor = createSensor({ available: true, granted: false });
    const adapter = new ExpoDeviceMotionAdapter(sensor);

    await expect(adapter.start(jest.fn())).resolves.toBe("permission-denied");
    expect(sensor.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(sensor.setUpdateInterval).not.toHaveBeenCalled();
    expect(sensor.addListener).not.toHaveBeenCalled();
  });

  test("normalizes a measurement and removes the subscription", async () => {
    let listener!: (measurement: DeviceMotionMeasurement) => void;
    const sensor = createSensor({ available: true, granted: true });
    (sensor.addListener as jest.Mock).mockImplementation(
      (next: (measurement: DeviceMotionMeasurement) => void) => {
        listener = next;
        return { remove: sensor.remove };
      },
    );
    const adapter = new ExpoDeviceMotionAdapter(sensor, () => 1234);
    const received = jest.fn();

    await expect(adapter.start(received)).resolves.toBe("active");
    expect(sensor.setUpdateInterval).toHaveBeenCalledWith(
      DEVICE_MOTION_UPDATE_INTERVAL_MS,
    );
    listener({
      acceleration: { x: 1, y: 2, z: 3, timestamp: 1 },
      accelerationIncludingGravity: { x: 0, y: 0, z: 0, timestamp: 1 },
      rotation: { alpha: 0, beta: 0, gamma: 0, timestamp: 1 },
      rotationRate: { alpha: 4, beta: 5, gamma: 6, timestamp: 1 },
      interval: 50,
      orientation: 0,
    });
    expect(received).toHaveBeenCalledWith({
      receivedAt: 1234,
      acceleration: { x: 1, y: 2, z: 3 },
      rotationRate: { x: 4, y: 5, z: 6 },
    });

    adapter.stop();
    expect(sensor.remove).toHaveBeenCalledTimes(1);
    adapter.stop();
    expect(sensor.remove).toHaveBeenCalledTimes(1);
  });
});

function createSensor({
  available,
  granted = true,
}: {
  available: boolean;
  granted?: boolean;
}) {
  return {
    isAvailableAsync: jest.fn(async () => available),
    getPermissionsAsync: jest.fn(async () => ({ granted })),
    requestPermissionsAsync: jest.fn(async () => ({ granted })),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    remove: jest.fn(),
  };
}
