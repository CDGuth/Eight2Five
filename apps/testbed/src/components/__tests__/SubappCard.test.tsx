import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("testbed shell navigation", () => {
  test("contains the toolbar action slot without drawer navigation", () => {
    const source = readFileSync(
      resolve(__dirname, "../TestbedShell.tsx"),
      "utf8",
    );

    expect(source).toContain("TestbedToolbarActionSlot");
    expect(source).not.toContain("Drawer");
    expect(source).not.toContain("testbed-menu-button");
  });
});
