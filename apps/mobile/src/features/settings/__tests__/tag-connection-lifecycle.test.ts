import { ownTagDiscoveryWhileFocused } from "../tag-connection-lifecycle";

describe("Tag Connection discovery lifecycle", () => {
  test("focus starts a page-owned scan and blur stops it", async () => {
    const store = {
      startTagDiscovery: jest.fn(async () => undefined),
      stopManualDiscovery: jest.fn(),
    };
    const cleanup = ownTagDiscoveryWhileFocused(store, true, false, jest.fn());
    await Promise.resolve();
    expect(store.startTagDiscovery).toHaveBeenCalledTimes(1);
    cleanup();
    expect(store.stopManualDiscovery).toHaveBeenCalledTimes(1);
  });

  test("does not replace an already-connected global session", () => {
    const store = {
      startTagDiscovery: jest.fn(async () => undefined),
      stopManualDiscovery: jest.fn(),
    };
    const cleanup = ownTagDiscoveryWhileFocused(store, true, true, jest.fn());
    expect(store.startTagDiscovery).not.toHaveBeenCalled();
    cleanup();
    expect(store.stopManualDiscovery).not.toHaveBeenCalled();
  });
});
