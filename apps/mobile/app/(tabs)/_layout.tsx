import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import { MOBILE_TABS } from "../../src/navigation/mobile-tabs";
import { useTabBarVisibility } from "../../src/navigation/tab-bar-visibility-context";

export default function MobileTabsLayout() {
  const theme = useEight2FiveTheme();
  const { drillFeaturesEnabled, nativeTabBarHidden, nativeTabsRevision } =
    useTabBarVisibility();

  return (
    <NativeTabs
      key={`mobile-tabs-${nativeTabsRevision}`}
      backgroundColor={theme.surface}
      hidden={nativeTabBarHidden}
      iconColor={{ default: theme.textMuted, selected: theme.accent }}
      tintColor={theme.accent}
      backBehavior="initialRoute"
    >
      {MOBILE_TABS.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          hidden={tab.name === "drill" && !drillFeaturesEnabled}
        >
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon {...tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
