import { NativeTabs } from "expo-router/unstable-native-tabs";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { MANAGER_TABS } from "../../src/pans-manager/manager-tabs";

export default function TestbedTabsLayout() {
  const theme = useEight2FiveTheme();

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      iconColor={{ default: theme.textMuted, selected: theme.accent }}
      labelStyle={{ fontFamily: eight2FiveFonts.utilityMedium }}
      tintColor={theme.accent}
    >
      {MANAGER_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon {...tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
