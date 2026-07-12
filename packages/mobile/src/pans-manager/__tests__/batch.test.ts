import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansBatchOperationService } from "../PansBatchOperationService";

describe("PansBatchOperationService", () => {
  test("runs sequentially, retries one transient failure, and retains successes on cancellation", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = new PansBatchOperationService(repository);
    const controller = new AbortController();
    const calls: string[] = [];
    const changes = jest.fn();
    let firstAttempts = 0;
    const result = await service.run({
      id: "batch",
      type: "configure",
      deviceIds: ["a", "b"],
      signal: controller.signal,
      onItemChange: changes,
      operation: async (deviceId) => {
        calls.push(deviceId);
        if (deviceId === "a" && firstAttempts++ === 0)
          throw { code: "TIMEOUT", message: "retry" };
        controller.abort();
        return "ok";
      },
    });
    expect(calls).toEqual(["a", "a"]);
    expect(result.operation.status).toBe("cancelled");
    expect(result.items).toEqual([
      expect.objectContaining({
        deviceId: "a",
        status: "succeeded",
        attempts: 2,
      }),
      expect.objectContaining({ deviceId: "b", status: "skipped" }),
    ]);
    expect(changes).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "a", status: "verifying" }),
    );
    expect(changes).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "b", status: "skipped" }),
    );
  });

  test("retries only failed items and retains cumulative attempts and metadata", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = new PansBatchOperationService(repository);
    let failB = true;
    const operation = jest.fn(async (deviceId: string) => {
      if (deviceId === "b" && failB) throw new Error("failed");
      return deviceId;
    });
    const first = await service.run({
      id: "retry-batch",
      type: "pan-migration",
      deviceIds: ["a", "b"],
      metadata: { oldPanId: 1, intendedPanId: 2 },
      operation,
    });
    expect(first.items[1]).toEqual(
      expect.objectContaining({ status: "failed", attempts: 1 }),
    );

    failB = false;
    const retried = await service.run({
      id: "retry-batch",
      type: "pan-migration",
      deviceIds: ["a", "b"],
      metadata: { oldPanId: 99, intendedPanId: 100 },
      operation,
    });
    expect(operation.mock.calls.map(([deviceId]) => deviceId)).toEqual([
      "a",
      "b",
      "b",
    ]);
    expect(retried.items[1]).toEqual(
      expect.objectContaining({ status: "succeeded", attempts: 2 }),
    );
    expect(retried.operation.metadata).toEqual({
      oldPanId: 1,
      intendedPanId: 2,
    });
  });
});
