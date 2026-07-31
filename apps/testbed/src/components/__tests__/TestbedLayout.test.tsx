import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("testbed root composition", () => {
  test("mounts one manager provider and the app shell around the router stack", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../app/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain("<PansManagerProvider>");
    expect(source).toContain("<TestbedShell>");
    expect(source).toContain("<Stack");
  });
});
