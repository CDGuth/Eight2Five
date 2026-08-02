import type { Drill } from "@eight2five/mobile/drill";

import { createDrillMenuActions } from "../drill-menu-state";

const drills: Drill[] = [
  {
    id: "one",
    name: "Opener 2026",
    fieldPreset: "football-nfhs",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "two",
    name: "Closer",
    fieldPreset: "football-nfhs",
    createdAt: 2,
    updatedAt: 2,
  },
];

describe("active drill menu", () => {
  test("marks the active drill and preserves the no-drill action", () => {
    expect(createDrillMenuActions(drills, "one")).toMatchObject([
      { id: "__no-drill__", state: "off" },
      { id: "one", state: "on" },
      { id: "two", state: "off" },
    ]);
  });

  test("disables every native action while storage is busy", () => {
    expect(
      createDrillMenuActions(drills, null, true).every(
        (action) => action.attributes?.disabled,
      ),
    ).toBe(true);
  });
});
