import { Alert } from "react-native";
import type { AnchorFieldPosition } from "@eight2five/mobile/field";

export function confirmAnchorPositionWrite(
  position: AnchorFieldPosition,
  onConfirm: () => void,
): void {
  Alert.alert(
    "Write anchor position?",
    `This will write X ${position.xMeters.toFixed(3)} m, Y ${position.yMeters.toFixed(3)} m, Z ${position.zMeters.toFixed(3)} m to PANS hardware. Incorrect positions can make reported locations inaccurate.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Write Position", onPress: onConfirm },
    ],
  );
}
