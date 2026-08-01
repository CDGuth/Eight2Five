import React from "react";
import { useRouter } from "expo-router";

import {
  INITIAL_MOBILE_TAB_NAVIGATION_STATE,
  reduceMobileTabNavigationState,
  shouldHideNativeTabBar,
  type MobileTabNavigationState,
} from "./mobile-tabs";

interface FieldPresentation {
  focused: boolean;
  landscape: boolean;
}

interface TabBarVisibilityContextValue extends MobileTabNavigationState {
  nativeTabBarHidden: boolean;
  setFieldPresentation(presentation: FieldPresentation): void;
  /**
   * Call only after the setting has been persisted. This safely leaves Drill,
   * then changes tab membership and remounts the native navigator exactly once.
   */
  reconfigureDrillFeatures(enabled: boolean): void;
}

const TabBarVisibilityContext = React.createContext<
  TabBarVisibilityContextValue | undefined
>(undefined);

export function TabBarVisibilityProvider({
  children,
  drillFeaturesEnabled,
}: {
  children: React.ReactNode;
  drillFeaturesEnabled: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = React.useReducer(reduceMobileTabNavigationState, {
    ...INITIAL_MOBILE_TAB_NAVIGATION_STATE,
    drillFeaturesEnabled,
  });
  const configuredDrillFeatures = React.useRef(drillFeaturesEnabled);

  const setFieldPresentation = React.useCallback(
    ({ focused, landscape }: FieldPresentation) => {
      dispatch({
        type: "field-presentation-changed",
        fieldFocused: focused,
        fieldLandscape: landscape,
      });
    },
    [],
  );

  const reconfigureDrillFeatures = React.useCallback(
    (enabled: boolean) => {
      if (configuredDrillFeatures.current === enabled) return;

      configuredDrillFeatures.current = enabled;
      router.replace("/(tabs)/field");
      dispatch({ type: "drill-features-reconfigured", enabled });
    },
    [router],
  );

  React.useEffect(() => {
    reconfigureDrillFeatures(drillFeaturesEnabled);
  }, [drillFeaturesEnabled, reconfigureDrillFeatures]);

  const value = React.useMemo<TabBarVisibilityContextValue>(
    () => ({
      ...state,
      nativeTabBarHidden: shouldHideNativeTabBar(state),
      setFieldPresentation,
      reconfigureDrillFeatures,
    }),
    [reconfigureDrillFeatures, setFieldPresentation, state],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibilityContextValue {
  const value = React.useContext(TabBarVisibilityContext);
  if (!value) {
    throw new Error(
      "useTabBarVisibility must be used inside TabBarVisibilityProvider.",
    );
  }
  return value;
}
