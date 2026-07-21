import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MANAGER_TABS } from "../manager-tabs";

describe("DWM1001 manager integrated tab flow", () => {
  const root = resolve(__dirname, "..");
  const appDir = resolve(root, "../../../app/(subapps)/dwm1001-manager");

  test("the three tab routes exist and render their screens", () => {
    const expectations: (readonly [string, string])[] = [
      ["networks-devices.tsx", "<NetworksDevicesScreen />"],
      ["map.tsx", "<ManagerMapScreen />"],
      ["info.tsx", "<ManagerInfoScreen />"],
    ];
    for (const [file, snippet] of expectations) {
      const route = readFileSync(resolve(appDir, "(tabs)", file), "utf8");
      expect(route).toContain(snippet);
    }
  });

  test("removed dashboard, discovery, network dashboard, and grid routes no longer exist", () => {
    const removedRoutes = [
      "index.tsx",
      "discovery.tsx",
      "networks/[networkId]/index.tsx",
      "networks/[networkId]/grid.tsx",
    ];
    for (const file of removedRoutes) {
      expect(existsSync(resolve(appDir, file))).toBe(false);
    }
    const removedSources = [
      "screens/dashboard-screen.tsx",
      "screens/discovery-screen.tsx",
      "screens/network-dashboard-screen.tsx",
      "screens/network-grid-screen.tsx",
      "components/discovery-device-row.tsx",
    ];
    for (const file of removedSources) {
      expect(existsSync(resolve(root, file))).toBe(false);
    }
  });

  test("MANAGER_TABS remains the three static tabs in order", () => {
    expect(MANAGER_TABS.map((tab) => tab.name)).toEqual([
      "networks-devices",
      "map",
      "info",
    ]);
  });
});
