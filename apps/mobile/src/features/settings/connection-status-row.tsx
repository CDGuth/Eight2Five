import React from "react";
import { Animated, Easing } from "react-native";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react-native";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import type { TagConnectionState } from "../../pans/mobile-pans-model";
import { connectionStatusViewModel } from "../../pans/mobile-pans-ui";

const ICONS = {
  connected: BluetoothConnected,
  searching: LoaderCircle,
  connecting: Bluetooth,
  disconnected: BluetoothOff,
  error: TriangleAlert,
} as const;

export function ConnectionStatusRow({
  state,
}: {
  readonly state: TagConnectionState;
}) {
  const theme = useEight2FiveTheme();
  const presentation = connectionStatusViewModel(state);
  const [spin] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (!presentation.animated) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
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
  }, [presentation.animated, spin]);

  const color =
    presentation.tone === "success"
      ? theme.success
      : presentation.tone === "accent"
        ? theme.accent
        : presentation.tone === "danger"
          ? theme.danger
          : theme.textMuted;
  const icon = (
    <Icon as={ICONS[presentation.icon]} size="lg" style={{ color }} />
  );
  return (
    <HStack
      accessible
      accessibilityLabel={presentation.label}
      testID="tag-connection-status"
      className="min-h-14 items-center"
      style={{ gap: 12, padding: eight2FiveSpacing.md }}
    >
      {presentation.animated ? (
        <Animated.View
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
          {icon}
        </Animated.View>
      ) : (
        icon
      )}
      <Text style={{ color, fontFamily: eight2FiveFonts.styleSemibold }}>
        {presentation.label}
      </Text>
    </HStack>
  );
}
