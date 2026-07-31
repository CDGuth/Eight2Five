import React from "react";
import { useFocusEffect } from "expo-router";
import { useWindowDimensions } from "react-native";

import { useTabBarVisibility } from "./tab-bar-visibility-context";

export interface FieldOrientationState {
  focused: boolean;
  landscape: boolean;
}

/** Bridges Field focus and physical viewport orientation to the native tabs. */
export function useFieldOrientation(): FieldOrientationState {
  const [focused, setFocused] = React.useState(false);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { setFieldPresentation } = useTabBarVisibility();

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  React.useEffect(() => {
    setFieldPresentation({ focused, landscape });
  }, [focused, landscape, setFieldPresentation]);

  React.useEffect(
    () => () => setFieldPresentation({ focused: false, landscape: false }),
    [setFieldPresentation],
  );

  return { focused, landscape };
}
