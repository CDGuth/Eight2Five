import { DEFAULT_APP_SETTINGS } from "@eight2five/mobile/settings";

import { buildDeveloperDiagnosticRows } from "../developer-diagnostics";
import {
  DEVELOPER_MODE_WARNING,
  canUseDeveloperControls,
  disableDeveloperMode,
  enableDeveloperMode,
} from "../developer-mode-actions";

describe("Developer Mode", () => {
  test("enables only through the explicit confirmation action", async () => {
    const enabled = { ...DEFAULT_APP_SETTINGS, developerModeEnabled: true };
    const writer = { update: jest.fn(async () => enabled) };

    await expect(enableDeveloperMode(writer)).resolves.toEqual(enabled);

    expect(writer.update).toHaveBeenCalledWith({ developerModeEnabled: true });
    expect(DEVELOPER_MODE_WARNING).toContain("modify PANS anchor positions");
    expect(DEVELOPER_MODE_WARNING).toContain("reported locations inaccurate");
  });

  test("disabling hides controls without changing another preference", async () => {
    const disabled = { ...DEFAULT_APP_SETTINGS, developerModeEnabled: false };
    const writer = { update: jest.fn(async () => disabled) };

    await disableDeveloperMode(writer);

    expect(writer.update).toHaveBeenCalledWith({ developerModeEnabled: false });
    expect(canUseDeveloperControls(disabled)).toBe(false);
  });

  test("diagnostic presentation never includes PANS quality", () => {
    const rows = buildDeveloperDiagnosticRows({
      initialization: "ready",
      connectionState: "connected",
      discoveries: [],
      livePosition: {
        connectionState: "connected",
        isStale: false,
        position: { xMeters: 1, yMeters: 2 },
      },
      rawPosition: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 99 } as never,
      lastUpdateAt: 1_700_000_000_000,
      effectiveUpdateRateHz: 9.5,
      diagnosticMessages: [],
      knownAnchors: [],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { label: "Raw PANS X", value: "1.000 m" },
        { label: "Effective update rate", value: "9.5 Hz" },
      ]),
    );
    expect(JSON.stringify(rows).toLowerCase()).not.toContain("quality");
    expect(JSON.stringify(rows)).not.toContain("99");
  });
});
