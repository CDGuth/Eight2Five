import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansPositionLogService } from "../PansPositionLogService";
import type { PositionLogSample } from "../types";

const position = { xMeters: 1, yMeters: 2, zMeters: 3, quality: 90 };
const options = { solver: "pans", anchorCount: 4 };

async function createService(
  repository: InMemoryPansManagerRepository,
  overrides: ConstructorParameters<typeof PansPositionLogService>[1] = {},
) {
  const service = new PansPositionLogService(repository, {
    createId: () => "session",
    ...overrides,
  });
  await service.startSession({
    networkId: "network",
    panId: 1,
    deviceId: "tag",
  });
  return service;
}

describe("PansPositionLogService bounded ingestion", () => {
  afterEach(() => jest.useRealTimers());

  test("caps accepted work, drops newest, and increments sequence only when accepted", async () => {
    const repository = new DeferredRepository();
    const service = await createService(repository, {
      memoryCap: 3,
      flushSize: 2,
    });

    const first = service.ingestSample("session", position, options);
    const second = service.ingestSample("session", position, options);
    const third = service.ingestSample("session", position, options);
    const dropped = service.ingestSample("session", position, options);

    expect([first, second, third].every((result) => result.accepted)).toBe(
      true,
    );
    expect(dropped).toMatchObject({ accepted: false, reason: "backpressure" });
    expect(service.getIngestionCounters("session")).toMatchObject({
      accepted: 3,
      droppedBackpressure: 1,
      queuedSamples: 3,
      highWaterMark: 3,
    });
    expect(repository.maxInFlight).toBe(1);

    repository.resolveNext();
    await service.flush("session");
    const next = service.ingestSample("session", position, options);
    expect(next.accepted && next.sample.sequence).toBe(3);
    await service.flush("session");
    expect(
      (await repository.listPositionLogSamples("session")).map(
        (s) => s.sequence,
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  test("flushes below-threshold samples after the maximum latency", async () => {
    jest.useFakeTimers();
    const repository = new InMemoryPansManagerRepository();
    const append = jest.spyOn(repository, "appendPositionLogSamples");
    const service = await createService(repository, { flushSize: 10 });
    service.ingestSample("session", position, options);

    await jest.advanceTimersByTimeAsync(999);
    expect(append).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(append).toHaveBeenCalledTimes(1);
    await service.flush("session");
    expect(service.getIngestionCounters("session")).toMatchObject({
      accepted: 1,
      persisted: 1,
      queuedSamples: 0,
      flushes: 1,
    });
  });

  test("requeues a failed batch at the front without exceeding the cap", async () => {
    const repository = new FailOnceRepository();
    const service = await createService(repository, {
      memoryCap: 4,
      flushSize: 2,
      now: () => 123,
    });
    service.ingestSample("session", position, options);
    service.ingestSample("session", position, options);
    service.ingestSample("session", position, options);

    await expect(service.flush("session")).rejects.toThrow("write failed");
    expect(service.getIngestionCounters("session")).toMatchObject({
      accepted: 3,
      persisted: 0,
      queuedSamples: 3,
      flushFailures: 1,
      lastError: "write failed",
      lastErrorAt: 123,
    });
    await service.flush("session");
    expect(
      (await repository.listPositionLogSamples("session")).map(
        (s) => s.sequence,
      ),
    ).toEqual([0, 1, 2]);
  });

  test("stop rejects new ingestion and drains all accepted work in order", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = await createService(repository, { flushSize: 2 });
    for (let index = 0; index < 5; index += 1)
      service.ingestSample("session", position, {
        ...options,
        timestampMs: index,
      });

    const stopped = await service.stopSession("session");
    const rejected = service.ingestSample("session", position, options);
    expect(stopped?.endedAt).toBeDefined();
    expect(rejected).toMatchObject({ accepted: false, reason: "closed" });
    expect(
      (await repository.listPositionLogSamples("session")).map(
        (s) => s.sequence,
      ),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(service.getIngestionCounters("session")).toMatchObject({
      accepted: 5,
      persisted: 5,
      droppedInvalid: 1,
      queuedSamples: 0,
      flushes: 3,
      flushFailures: 0,
    });
  });

  test("returns immutable, explicit invalid and unknown-session results", async () => {
    const service = await createService(new InMemoryPansManagerRepository());
    const invalid = service.ingestSample(
      "session",
      { ...position, quality: 101 },
      options,
    );
    const unknown = service.ingestSample("missing", position, options);
    expect(invalid).toMatchObject({ accepted: false, reason: "invalid" });
    expect(unknown).toMatchObject({
      accepted: false,
      reason: "unknown-session",
    });
    expect(Object.isFrozen(invalid.counters)).toBe(true);
    expect(service.getIngestionCounters("missing").droppedInvalid).toBe(1);
  });
});

class DeferredRepository extends InMemoryPansManagerRepository {
  private resolvers: (() => void)[] = [];
  private deferNext = true;
  private active = 0;
  maxInFlight = 0;

  override async appendPositionLogSamples(
    samples: PositionLogSample[],
  ): Promise<void> {
    this.active += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.active);
    if (this.deferNext) {
      this.deferNext = false;
      await new Promise<void>((resolve) => this.resolvers.push(resolve));
    }
    await super.appendPositionLogSamples(samples);
    this.active -= 1;
  }

  resolveNext(): void {
    this.resolvers.shift()?.();
  }
}

class FailOnceRepository extends InMemoryPansManagerRepository {
  private shouldFail = true;

  override async appendPositionLogSamples(
    samples: PositionLogSample[],
  ): Promise<void> {
    if (this.shouldFail) {
      this.shouldFail = false;
      throw new Error("write failed");
    }
    await super.appendPositionLogSamples(samples);
  }
}
