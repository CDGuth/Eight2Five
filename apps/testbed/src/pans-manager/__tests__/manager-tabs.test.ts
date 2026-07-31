import { MANAGER_TABS } from "../manager-tabs";

describe("DWM1001 manager native tabs", () => {
  it("defines the three static manager destinations in order", () => {
    expect(MANAGER_TABS.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: "networks-devices", label: "Networks & Devices" },
      { name: "map", label: "Map" },
      { name: "info", label: "Info" },
    ]);
  });

  it("uses the requested platform-native icons", () => {
    expect(MANAGER_TABS.map(({ icon }) => icon)).toEqual([
      {
        sf: {
          default: "dot.radiowaves.left.and.right",
          selected: "antenna.radiowaves.left.and.right",
        },
        md: "hub",
      },
      {
        sf: { default: "map", selected: "map.fill" },
        md: "map",
      },
      {
        sf: { default: "info.circle", selected: "info.circle.fill" },
        md: "info",
      },
    ]);
  });
});
