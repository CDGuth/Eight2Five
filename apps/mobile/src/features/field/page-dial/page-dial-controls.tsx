import { Center } from "@eight2five/ui/components/center";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { Minus, Plus } from "lucide-react-native";
import { getDrillTerms, type DrillTerminology } from "@eight2five/mobile/drill";

import {
  getPageDialAccessibilityLabel,
  getPageDialControlState,
  getPageDialProportions,
} from "./page-dial-layout";

export function PageDialControls({
  diameter,
  selectedIndex,
  selectedLabel,
  pageCount,
  terminology,
  onPrevious,
  onNext,
}: {
  readonly diameter: number;
  readonly selectedIndex: number;
  readonly selectedLabel?: string;
  readonly pageCount: number;
  readonly terminology: DrillTerminology;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  const terms = getDrillTerms(terminology);
  const proportions = getPageDialProportions(diameter);
  const state = getPageDialControlState(selectedIndex, pageCount);
  const buttonSize = Math.max(48, diameter * 0.31);
  const center = diameter / 2;
  const previousCenter = center - proportions.controlCenterOffset;
  const nextCenter = center + proportions.controlCenterOffset;
  const centerDiameter = proportions.centerDiskDiameter;

  return (
    <>
      <Pressable
        accessibilityLabel={`Previous ${terms.lowercaseSingular}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.previousDisabled }}
        disabled={state.previousDisabled}
        onPress={onPrevious}
        style={{
          position: "absolute",
          left: previousCenter - buttonSize / 2,
          top: center - buttonSize / 2,
          width: buttonSize,
          height: buttonSize,
          alignItems: "center",
          justifyContent: "center",
          opacity: state.previousDisabled ? 0.34 : 1,
        }}
        testID="page-dial-previous"
      >
        <Icon as={Minus} size={24} style={{ color: "#FFFFFF" }} />
      </Pressable>
      <Center
        accessible
        accessibilityLabel={getPageDialAccessibilityLabel({
          selectedIndex,
          selectedLabel,
          pageCount,
          terminology,
        })}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: center - centerDiameter / 2,
          top: center - centerDiameter / 2,
          width: centerDiameter,
          height: centerDiameter,
        }}
      >
        <Text
          size="xs"
          style={{ color: "#FFFFFF", fontSize: Math.max(8, diameter * 0.06) }}
        >
          {terms.singular}
        </Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: Math.max(15, diameter * 0.11),
            lineHeight: Math.max(16, diameter * 0.115),
            fontVariant: ["tabular-nums"],
          }}
        >
          {selectedIndex >= 0 ? (selectedLabel ?? selectedIndex + 1) : "–"}
        </Text>
      </Center>
      <Pressable
        accessibilityLabel={`Next ${terms.lowercaseSingular}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.nextDisabled }}
        disabled={state.nextDisabled}
        onPress={onNext}
        style={{
          position: "absolute",
          left: nextCenter - buttonSize / 2,
          top: center - buttonSize / 2,
          width: buttonSize,
          height: buttonSize,
          alignItems: "center",
          justifyContent: "center",
          opacity: state.nextDisabled ? 0.34 : 1,
        }}
        testID="page-dial-next"
      >
        <Icon as={Plus} size={24} style={{ color: "#FFFFFF" }} />
      </Pressable>
    </>
  );
}
