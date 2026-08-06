import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from "react-native-reanimated";

export function AnimatedValueSwitch({
  displayKey,
  children,
  style,
  testID,
}: {
  readonly displayKey: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const entering = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
  const exiting = FadeOut.duration(160).reduceMotion(ReduceMotion.System);

  return (
    <View style={[{ height: 48, overflow: "hidden" }, style]} testID={testID}>
      <Animated.View
        key={displayKey}
        entering={entering}
        exiting={exiting}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          justifyContent: "center",
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
