import type { NativeTabsTriggerIconProps } from "expo-router/unstable-native-tabs";

export type MobileTabName = "field" | "drill" | "settings";

export interface MobileTabConfig {
  name: MobileTabName;
  label: string;
  icon: NativeTabsTriggerIconProps;
}

export const MOBILE_TABS = [
  {
    name: "field",
    label: "Field",
    icon: {
      sf: { default: "map", selected: "map.fill" },
      md: "map",
    },
  },
  {
    name: "drill",
    label: "Drill",
    icon: {
      sf: {
        default: "list.bullet.rectangle",
        selected: "list.bullet.rectangle.fill",
      },
      md: "format_list_numbered",
    },
  },
  {
    name: "settings",
    label: "Settings",
    icon: {
      sf: { default: "gearshape", selected: "gearshape.fill" },
      md: "settings",
    },
  },
] as const satisfies readonly MobileTabConfig[];

export function shouldHideNativeTabBar({
  fieldFocused,
  fieldLandscape,
}: Pick<MobileTabNavigationState, "fieldFocused" | "fieldLandscape">): boolean {
  return fieldFocused && fieldLandscape;
}

export interface MobileTabNavigationState {
  fieldFocused: boolean;
  fieldLandscape: boolean;
  drillFeaturesEnabled: boolean;
  nativeTabsRevision: number;
}

export const INITIAL_MOBILE_TAB_NAVIGATION_STATE: MobileTabNavigationState = {
  fieldFocused: false,
  fieldLandscape: false,
  drillFeaturesEnabled: true,
  nativeTabsRevision: 0,
};

export type MobileTabNavigationAction =
  | {
      type: "field-presentation-changed";
      fieldFocused: boolean;
      fieldLandscape: boolean;
    }
  | { type: "drill-features-reconfigured"; enabled: boolean };

export function reduceMobileTabNavigationState(
  state: MobileTabNavigationState,
  action: MobileTabNavigationAction,
): MobileTabNavigationState {
  if (action.type === "field-presentation-changed") {
    if (
      state.fieldFocused === action.fieldFocused &&
      state.fieldLandscape === action.fieldLandscape
    ) {
      return state;
    }
    return {
      ...state,
      fieldFocused: action.fieldFocused,
      fieldLandscape: action.fieldLandscape,
    };
  }

  if (state.drillFeaturesEnabled === action.enabled) return state;
  return {
    ...state,
    drillFeaturesEnabled: action.enabled,
    nativeTabsRevision: state.nativeTabsRevision + 1,
  };
}
