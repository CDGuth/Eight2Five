import React from "react";
import { BlurView } from "expo-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  useEight2FiveTheme,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

export const FieldBlurTargetContext =
  React.createContext<React.RefObject<View | null> | null>(null);

export function FrostedFieldSurface({
  children,
  borderRadius,
  style,
  intensity = 82,
  overlayOpacity = 0.72,
  shadow = true,
  testID,
  accessibilityLabel,
}: {
  readonly children: React.ReactNode;
  readonly borderRadius: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly intensity?: number;
  readonly overlayOpacity?: number;
  readonly shadow?: boolean;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}) {
  const theme = useEight2FiveTheme();
  const themeName = useEight2FiveThemeName();
  const blurTarget = React.useContext(FieldBlurTargetContext);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderRadius,
          borderCurve: "continuous",
          overflow: "hidden",
          ...(shadow
            ? { boxShadow: `0 5px 18px ${theme.shadowStrong}` }
            : null),
        },
        style,
      ]}
      testID={testID}
    >
      <BlurView
        pointerEvents="none"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget ?? undefined}
        intensity={intensity}
        tint={themeName === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colorWithOpacity(
              theme.surfaceRaised,
              overlayOpacity,
            ),
          },
        ]}
      />
      {children}
    </View>
  );
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const value = hex[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
