import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
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
  const entering = (direction > 0 ? FadeInRight : FadeInLeft)
    .duration(180)
    .reduceMotion(ReduceMotion.System);
  const exiting = (direction > 0 ? FadeOutLeft : FadeOutRight)
    .duration(180)
    .reduceMotion(ReduceMotion.System);

  return (
    <View style={[{ overflow: "hidden" }, style]} testID={testID}>
      <Animated.View key={displayKey} entering={entering} exiting={exiting}>
        {children}
      </Animated.View>
    </View>
  );
}
