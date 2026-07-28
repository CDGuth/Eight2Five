import fs from "node:fs";
import path from "node:path";

describe("NetworkLogScreen live sample architecture", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../screens/network-log-screen.tsx"),
    "utf8",
  );

  test("uses one virtualized root list instead of nesting samples in ManagerScreen", () => {
    expect(source).toContain('testID="position-log-sample-list"');
    expect(source).toContain("<FlatList");
    expect(source).toContain("keyExtractor={(sample) =>");
    expect(source).toContain("React.memo(function RecentSampleRow");
    expect(source).not.toContain("recent.map(");
    expect(source).not.toContain("<ManagerScreen>");
  });

  test("synchronously ingests into a bounded ring and throttles snapshots to four hertz", () => {
    expect(source).toContain("const RECENT_SAMPLE_CAP = 50");
    expect(source).toContain("const UI_PUBLISH_INTERVAL_MS = 250");
    expect(source).toContain("const result = ingestSample(");
    expect(source).not.toContain("void appendSample(");
    expect(source).toContain("scheduleSnapshotPublish();");
    expect(source).toContain("slice(-(RECENT_SAMPLE_CAP - 1))");
  });
});
