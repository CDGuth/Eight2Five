import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansPositionLogService } from "../PansPositionLogService";

describe("PansPositionLogService exports", () => {
  test("escapes CSV values and preserves exact sample data in JSON", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = new PansPositionLogService(repository, {
      flushSize: 10,
      createId: () => "session",
      now: () => 1_767_225_600_000,
    });
    await service.startSession({
      networkId: "network",
      panId: 42,
      deviceId: "device",
    });
    await service.appendSample(
      "session",
      { xMeters: 1.25, yMeters: 2, zMeters: -3, quality: 99 },
      {
        timestampMs: 123,
        nodeId: "node",
        label: 'a,"b"\nline',
        solver: "pans",
        anchorCount: 4,
        distances: [
          {
            nodeId: 7,
            anchorKey: "anchor-7",
            distanceMeters: 2.5,
            quality: 80,
          },
        ],
        notes: "exact JSON note",
        eventMarker: "start",
      },
    );
    const csv = await service.exportCsv("session");
    expect(csv.split("\r\n")[0]).toBe(
      "timestamp_iso,timestamp_ms,network_id,pan_id,device_id,node_id,label,x_m,y_m,z_m,quality,solver,anchor_count",
    );
    expect(csv).toContain('"a,""b""\nline"');
    const json = JSON.parse(await service.exportJson("session")) as {
      samples: unknown[];
    };
    expect(json.samples).toEqual([
      {
        sessionId: "session",
        sequence: 0,
        timestampMs: 123,
        networkId: "network",
        panId: 42,
        deviceId: "device",
        nodeId: "node",
        label: 'a,"b"\nline',
        xMeters: 1.25,
        yMeters: 2,
        zMeters: -3,
        quality: 99,
        solver: "pans",
        anchorCount: 4,
        distances: [
          {
            nodeId: 7,
            anchorKey: "anchor-7",
            distanceMeters: 2.5,
            quality: 80,
          },
        ],
        notes: "exact JSON note",
        eventMarker: "start",
      },
    ]);
  });

  test("serializes high-rate appends across buffer flushes", async () => {
    const repository = new InMemoryPansManagerRepository();
    const service = new PansPositionLogService(repository, {
      flushSize: 1,
      createId: () => "high-rate",
      now: () => 10,
    });
    await service.startSession({
      networkId: "network",
      panId: 1,
      deviceId: "tag",
    });

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        service.appendSample(
          "high-rate",
          {
            xMeters: index,
            yMeters: index,
            zMeters: 0,
            quality: 100,
          },
          { solver: "pans", anchorCount: 4, timestampMs: index },
        ),
      ),
    );
    await service.stopSession("high-rate");

    const samples = await repository.listPositionLogSamples("high-rate");
    expect(samples).toHaveLength(20);
    expect(samples.map((sample) => sample.sequence)).toEqual(
      Array.from({ length: 20 }, (_, index) => index),
    );
  });
});
