import React from "react";
import { Animated, Easing } from "react-native";
import { LoaderCircle } from "lucide-react-native";
import { Icon } from "@eight2five/ui/components/icon";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

export function SpinningLoaderIcon({
  color,
  size = "md",
}: {
  readonly color?: string;
  readonly size?: React.ComponentProps<typeof Icon>["size"];
}) {
  const theme = useEight2FiveTheme();
  const resolvedColor = color ?? theme.raw.white;
  const [spin] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        transform: [
          {
            rotate: spin.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      }}
    >
      <Icon as={LoaderCircle} size={size} style={{ color: resolvedColor }} />
    </Animated.View>
  );
}
