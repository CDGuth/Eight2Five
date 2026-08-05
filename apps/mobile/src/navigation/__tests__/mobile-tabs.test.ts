import {
  INITIAL_MOBILE_TAB_NAVIGATION_STATE,
  MOBILE_TABS,
  reduceMobileTabNavigationState,
  shouldHideNativeTabBar,
} from "../mobile-tabs";

describe("mobile native tab navigation", () => {
  test("keeps Field first and exposes the expected tabs", () => {
    expect(MOBILE_TABS.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: "field", label: "Field" },
      { name: "drill", label: "Drill" },
      { name: "settings", label: "Settings" },
      { name: "info", label: "Info" },
    ]);
  });

  test("uses native info icons and keeps Info available", () => {
    const infoTab = MOBILE_TABS.find(({ name }) => name === "info");

    expect(infoTab).toEqual({
      name: "info",
      label: "Info",
      icon: {
        sf: { default: "info.circle", selected: "info.circle.fill" },
        md: "info",
      },
    });
  });

  test("hides the entire tab bar only for focused landscape Field", () => {
    expect(
      shouldHideNativeTabBar({ fieldFocused: true, fieldLandscape: true }),
    ).toBe(true);
    expect(
      shouldHideNativeTabBar({ fieldFocused: true, fieldLandscape: false }),
    ).toBe(false);
    expect(
      shouldHideNativeTabBar({ fieldFocused: false, fieldLandscape: true }),
    ).toBe(false);
  });

  test("remounts native tabs exactly once per drill-feature change", () => {
    const disabled = reduceMobileTabNavigationState(
      INITIAL_MOBILE_TAB_NAVIGATION_STATE,
      { type: "drill-features-reconfigured", enabled: false },
    );
    expect(disabled).toMatchObject({
      drillFeaturesEnabled: false,
      nativeTabsRevision: 1,
    });

    const unchanged = reduceMobileTabNavigationState(disabled, {
      type: "drill-features-reconfigured",
      enabled: false,
    });
    expect(unchanged).toBe(disabled);

    expect(
      reduceMobileTabNavigationState(unchanged, {
        type: "drill-features-reconfigured",
        enabled: true,
      }),
    ).toMatchObject({
      drillFeaturesEnabled: true,
      nativeTabsRevision: 2,
    });
  });
});
