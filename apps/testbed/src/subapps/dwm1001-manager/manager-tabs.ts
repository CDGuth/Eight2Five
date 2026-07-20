import type { NativeTabsTriggerIconProps } from "expo-router/unstable-native-tabs";

interface ManagerTabConfig {
  name: "networks-devices" | "map" | "info";
  label: string;
  icon: NativeTabsTriggerIconProps;
}

export const MANAGER_TABS = [
  {
    name: "networks-devices",
    label: "Networks & Devices",
    icon: {
      sf: {
        default: "dot.radiowaves.left.and.right",
        selected: "antenna.radiowaves.left.and.right",
      },
      md: "hub",
    },
  },
  {
    name: "map",
    label: "Map",
    icon: {
      sf: { default: "map", selected: "map.fill" },
      md: "map",
    },
  },
  {
    name: "info",
    label: "Info",
    icon: {
      sf: { default: "info.circle", selected: "info.circle.fill" },
      md: "info",
    },
  },
] as const satisfies readonly ManagerTabConfig[];
