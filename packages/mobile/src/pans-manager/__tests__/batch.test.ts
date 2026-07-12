import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansBatchOperationService } from "../PansBatchOperationService";

describe("PansBatchOperationService", () => {
  test("runs sequentially, retries one transient failure, and retains successes on cancellation", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = new PansBatchOperationService(repository);
    const controller = new AbortController();
    const calls: string[] = [];
    let firstAttempts = 0;
    const result = await service.run({
      id: "batch",
      type: "configure",
      deviceIds: ["a", "b"],
      signal: controller.signal,
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
  });
});
