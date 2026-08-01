import { DEFAULT_APP_SETTINGS } from "@eight2five/mobile/settings";

import {
  RESET_SETTINGS_MESSAGE,
  resetAppSettings,
  updateDrillFeatures,
} from "../settings-actions";

describe("settings actions", () => {
  test("persists Drill disablement before reconfiguring native tabs", async () => {
    const events: string[] = [];
    const writer = {
      update: jest.fn(async () => {
        events.push("persist");
        return { ...DEFAULT_APP_SETTINGS, drillFeaturesEnabled: false };
      }),
      resetPreferences: jest.fn(),
    };

    await updateDrillFeatures(
      writer,
      (enabled) => events.push(`reconfigure:${enabled}`),
      false,
    );

    expect(writer.update).toHaveBeenCalledWith({ drillFeaturesEnabled: false });
    expect(events).toEqual(["persist", "reconfigure:false"]);
  });

  test("reset preserves selection through the repository and restores Drill", async () => {
    const reset = {
      ...DEFAULT_APP_SETTINGS,
      activeDrillId: "drill-1",
      selectedDrillPageId: "page-2",
    };
    const writer = {
      update: jest.fn(),
      resetPreferences: jest.fn(async () => reset),
    };
    const reconfigure = jest.fn();

    await expect(resetAppSettings(writer, reconfigure)).resolves.toEqual(reset);
    expect(reconfigure).toHaveBeenCalledTimes(1);
    expect(reconfigure).toHaveBeenCalledWith(true);
  });

  test("reset confirmation states destructive boundaries", () => {
    expect(RESET_SETTINGS_MESSAGE).toBe(
      "This restores display, drill-feature, terminology, and developer preferences to their defaults.\n\n" +
        "It does not delete drills, forget the remembered tag, delete cached anchor positions, or modify PANS hardware.",
    );
  });
});
