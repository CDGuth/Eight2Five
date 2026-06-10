import { createAutoBeaconSource } from "../AutoSource";
import type { BeaconSource, BeaconSourceSubscription } from "../types";

type MockBeaconSource = BeaconSource & {
  start: jest.Mock<Promise<void>, []>;
  stop: jest.Mock<void, []>;
  subscribe: jest.Mock<
    BeaconSourceSubscription,
    [Parameters<BeaconSource["subscribe"]>[0]]
  >;
  destroy: jest.Mock<void, []>;
};

const mockKbeaconSource = mockSource();
const mockPansSource = mockSource();

jest.mock("../KBeaconSource", () => ({
  createKBeaconSource: jest.fn(() => mockKbeaconSource),
}));

jest.mock("../PansBleSource", () => ({
  createPansBleSource: jest.fn(() => mockPansSource),
}));

function mockSource(): MockBeaconSource {
  return {
    start: jest.fn(async () => undefined),
    stop: jest.fn(),
    subscribe: jest.fn((_listener) => ({ remove: jest.fn() })),
    destroy: jest.fn(),
  };
}

function resetSource(source: MockBeaconSource) {
  source.start.mockReset().mockResolvedValue(undefined);
  source.stop.mockReset();
  source.subscribe.mockReset().mockReturnValue({ remove: jest.fn() });
  source.destroy.mockReset();
}

describe("createAutoBeaconSource", () => {
  beforeEach(() => {
    resetSource(mockKbeaconSource);
    resetSource(mockPansSource);
  });

  it("resolves when both providers start successfully", async () => {
    const source = createAutoBeaconSource();

    await expect(source.start()).resolves.toBeUndefined();

    expect(mockKbeaconSource.start).toHaveBeenCalledTimes(1);
    expect(mockPansSource.start).toHaveBeenCalledTimes(1);
  });

  it("resolves when KBeacon fails but PANS starts", async () => {
    mockKbeaconSource.start.mockRejectedValueOnce(new Error("kbeacon denied"));
    const source = createAutoBeaconSource();

    await expect(source.start()).resolves.toBeUndefined();
  });

  it("resolves when PANS fails but KBeacon starts", async () => {
    mockPansSource.start.mockRejectedValueOnce(new Error("pans failed"));
    const source = createAutoBeaconSource();

    await expect(source.start()).resolves.toBeUndefined();
  });

  it("rejects when every provider fails", async () => {
    mockKbeaconSource.start.mockRejectedValueOnce(new Error("kbeacon denied"));
    mockPansSource.start.mockRejectedValueOnce(new Error("pans failed"));
    const source = createAutoBeaconSource();

    await expect(source.start()).rejects.toThrow(
      "All beacon providers failed to start.",
    );
  });

  it("invokes the optional diagnostic callback for provider failures", async () => {
    const error = new Error("kbeacon denied");
    mockKbeaconSource.start.mockRejectedValueOnce(error);
    const onError = jest.fn();
    const source = createAutoBeaconSource({ onError });

    await source.start();

    expect(onError).toHaveBeenCalledWith(error, "kbeacon");
  });

  it("stop attempts every provider", async () => {
    mockKbeaconSource.stop.mockImplementationOnce(() => {
      throw new Error("stop failed");
    });
    const source = createAutoBeaconSource();

    await expect(source.stop()).resolves.toBeUndefined();

    expect(mockKbeaconSource.stop).toHaveBeenCalledTimes(1);
    expect(mockPansSource.stop).toHaveBeenCalledTimes(1);
  });

  it("cleanup removes every subscription", () => {
    const kbeaconRemove = jest.fn();
    const pansRemove = jest.fn();
    mockKbeaconSource.subscribe.mockReturnValueOnce({ remove: kbeaconRemove });
    mockPansSource.subscribe.mockReturnValueOnce({ remove: pansRemove });
    const source = createAutoBeaconSource();

    const subscription = source.subscribe(() => {});
    subscription.remove();

    expect(kbeaconRemove).toHaveBeenCalledTimes(1);
    expect(pansRemove).toHaveBeenCalledTimes(1);
  });
});
