import { Icon } from "@eight2five/ui/components/icon";
import { HStack } from "@eight2five/ui/components/hstack";
import {
  BluetoothConnected,
  BluetoothOff,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react-native";
import type { FieldConnectionState } from "@eight2five/mobile/field";

const CONNECTION_PRESENTATION = {
  idle: { icon: BluetoothOff, label: "PANS tag idle", color: "#AAB0BA" },
  connecting: {
    icon: LoaderCircle,
    label: "Connecting to PANS tag",
    color: "#6FA0E1",
  },
  connected: {
    icon: BluetoothConnected,
    label: "PANS tag connected",
    color: "#68C36D",
  },
  reconnecting: {
    icon: RefreshCw,
    label: "Reconnecting to PANS tag",
    color: "#E2B84F",
  },
  disconnected: {
    icon: BluetoothOff,
    label: "PANS tag disconnected",
    color: "#AAB0BA",
  },
  error: {
    icon: TriangleAlert,
    label: "PANS tag connection error",
    color: "#E16B6B",
  },
} as const;

export function ConnectionIndicator({
  state,
}: {
  state: FieldConnectionState;
}) {
  const presentation = CONNECTION_PRESENTATION[state];
  return (
    <HStack
      accessible
      accessibilityLabel={presentation.label}
      accessibilityRole="image"
      className="h-12 w-10 items-center justify-center"
      testID={`connection-${state}`}
    >
      <Icon
        as={presentation.icon}
        size={22}
        style={{ color: presentation.color }}
      />
    </HStack>
  );
}
