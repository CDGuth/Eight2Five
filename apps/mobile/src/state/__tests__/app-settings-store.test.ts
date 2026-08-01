import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from "@eight2five/mobile/settings";
import type { OpenMobileRepositoriesResult } from "@eight2five/mobile/storage";

import { AppSettingsStore } from "../app-settings-store";
import { selectFieldSession } from "../field-session-store";

describe("AppSettingsStore", () => {
  test("hydrates, serializes updates, resets preferences, and closes storage", async () => {
    let settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      drillTerminology: "sets",
      activeDrillId: "drill-1",
      selectedDrillPageId: "page-1",
    };
    const close = jest.fn(async () => undefined);
    const settingsRepository = {
      load: jest.fn(async () => settings),
      update: jest.fn(async (partial) => {
        settings = { ...settings, ...partial };
        return settings;
      }),
      resetPreferences: jest.fn(async () => {
        settings = {
          ...DEFAULT_APP_SETTINGS,
          activeDrillId: settings.activeDrillId,
          selectedDrillPageId: settings.selectedDrillPageId,
        };
        return settings;
      }),
    };
    const drillRepository = {
      setActiveDrill: jest.fn(async (id: string | null) => {
        settings = {
          ...settings,
          activeDrillId: id,
          selectedDrillPageId: null,
        };
        return settings;
      }),
      setSelectedDrillPage: jest.fn(async (id: string | null) => {
        settings = { ...settings, selectedDrillPageId: id };
        return settings;
      }),
    };
    const storage = {
      settingsRepository,
      drillRepository,
      close,
    } as unknown as OpenMobileRepositoriesResult;
    const store = new AppSettingsStore(async () => storage);
    const listener = jest.fn();
    store.subscribe(listener);

    await store.initialize();
    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      settings: { drillTerminology: "sets", activeDrillId: "drill-1" },
    });

    await Promise.all([
      store.update({ guidanceEnabled: false }),
      store.update({ fieldPerspective: "performer" }),
    ]);
    expect(settingsRepository.update.mock.calls).toEqual([
      [{ guidanceEnabled: false }],
      [{ fieldPerspective: "performer" }],
    ]);

    await store.resetPreferences();
    expect(store.getSnapshot().settings).toEqual({
      ...DEFAULT_APP_SETTINGS,
      activeDrillId: "drill-1",
      selectedDrillPageId: "page-1",
    });
    expect(listener).toHaveBeenCalled();

    await store.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("publishes initialization errors and rejects writes before ready", async () => {
    const store = new AppSettingsStore(async () => {
      throw new Error("open failed");
    });
    await store.initialize();
    expect(store.getSnapshot()).toMatchObject({
      status: "error",
      error: new Error("open failed"),
    });
    await expect(store.update({ guidanceEnabled: false })).rejects.toThrow(
      "not ready",
    );
  });

  test("derives the persisted field session contract", () => {
    expect(
      selectFieldSession({
        ...DEFAULT_APP_SETTINGS,
        activeDrillId: "drill-1",
        selectedDrillPageId: "page-2",
      }),
    ).toEqual({
      activeDrillId: "drill-1",
      selectedDrillPageId: "page-2",
    });
  });
});
