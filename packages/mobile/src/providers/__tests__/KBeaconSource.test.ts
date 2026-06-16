import { createKBeaconSource } from "../KBeaconSource";
import {
  addBeaconDiscoveredListener,
  startScanning,
  stopScanning,
} from "expo-kbeaconpro";

let mockNativeListener: ((event: { beacons?: unknown[] }) => void) | null =
  null;
const mockRemove = jest.fn();

jest.mock("expo-kbeaconpro", () => ({
  startScanning: jest.fn(async () => undefined),
  stopScanning: jest.fn(),
  addBeaconDiscoveredListener: jest.fn(
    (listener: (event: { beacons?: unknown[] }) => void) => {
      mockNativeListener = listener;
      return { remove: mockRemove };
    },
  ),
}));

describe("createKBeaconSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemove.mockClear();
    mockNativeListener = null;
    (startScanning as jest.Mock).mockResolvedValue(undefined);
  });

  it("awaits scanner startup", async () => {
    const source = createKBeaconSource();

    await source.start();

    expect(startScanning).toHaveBeenCalledTimes(1);
  });

  it("forwards scan startup failures to onError and rethrows", async () => {
    const error = new Error("scan failed");
    (startScanning as jest.Mock).mockRejectedValueOnce(error);
    const onError = jest.fn();
    const source = createKBeaconSource({ onError });

    await expect(source.start()).rejects.toThrow("scan failed");

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("normalizes discovery event shape for subscribers", () => {
    const source = createKBeaconSource();
    const listener = jest.fn();

    source.subscribe(listener);
    mockNativeListener?.({
      beacons: [
        {
          mac: "AA:BB",
          rssi: -60,
          advPackets: [],
        },
      ],
    });

    expect(addBeaconDiscoveredListener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      rawBeacons: [{ mac: "AA:BB", rssi: -60, advPackets: [] }],
    });
  });

  it("cleans up listener subscriptions and stops scanning", () => {
    const source = createKBeaconSource();
    const subscription = source.subscribe(() => {});

    subscription.remove();
    source.stop();

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(stopScanning).toHaveBeenCalledTimes(1);
  });
});
