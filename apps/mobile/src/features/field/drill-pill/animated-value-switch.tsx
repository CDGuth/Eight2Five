import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  ReduceMotion,
} from "react-native-reanimated";

export function AnimatedValueSwitch({
  displayKey,
  direction,
  children,
  style,
  testID,
}: {
  readonly displayKey: string;
  readonly direction: -1 | 1;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const entering = (direction > 0 ? FadeInUp : FadeInDown)
    .duration(180)
    .reduceMotion(ReduceMotion.System);
  const exiting = (direction > 0 ? FadeOutUp : FadeOutDown)
    .duration(180)
    .reduceMotion(ReduceMotion.System);

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
