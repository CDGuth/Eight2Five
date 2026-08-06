import type { ViewStyle } from "react-native";
import { Center } from "@eight2five/ui/components/center";
import { Divider } from "@eight2five/ui/components/divider";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { CircleUserRound, Folder, Minus, Plus } from "lucide-react-native";
import { getDrillTerms, type DrillTerminology } from "@eight2five/mobile/drill";

import {
  getPageDialAccessibilityLabel,
  getPageDialControlState,
  getPageDialProportions,
} from "./page-dial-layout";
import {
  getPageDialCardinalPoints,
  getPageDialControlSize,
  getPageDialDividerSegments,
  type PageDialLineSegment,
} from "./page-dial-math";

export function PageDialControls({
  diameter,
  selectedIndex,
  selectedLabel,
  pageCount,
  terminology,
  onPrevious,
  onNext,
  onSelectDrill,
  onSelectPerformer,
  foregroundColor = "#FFFFFF",
}: {
  readonly diameter: number;
  readonly selectedIndex: number;
  readonly selectedLabel?: string;
  readonly pageCount: number;
  readonly terminology: DrillTerminology;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSelectDrill?: () => void;
  readonly onSelectPerformer?: () => void;
  readonly foregroundColor?: string;
}) {
  const terms = getDrillTerms(terminology);
  const proportions = getPageDialProportions(diameter);
  const state = getPageDialControlState(selectedIndex, pageCount);
  const buttonSize = getPageDialControlSize(diameter);
  const center = diameter / 2;
  const controlCenters = getPageDialCardinalPoints(
    diameter,
    proportions.controlCenterOffset,
  );
  const centerDiameter = proportions.centerDiskDiameter;
  const dividerSegments = getPageDialDividerSegments(
    diameter,
    proportions.innerDiskDiameter,
    centerDiameter,
  );
  const buttonStyle = (x: number, y: number, disabled = false) => ({
    position: "absolute" as const,
    left: x - buttonSize / 2,
    top: y - buttonSize / 2,
    width: buttonSize,
    height: buttonSize,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: disabled ? 0.34 : 1,
  });

  return (
    <>
      {dividerSegments.map((segment, index) => (
        <Divider
          key={`page-dial-control-divider-${index}`}
          orientation="vertical"
          pointerEvents="none"
          style={getDividerStyle(segment)}
        />
      ))}
      <Pressable
        accessibilityLabel="Select drill"
        accessibilityRole="button"
        accessibilityState={{ disabled: !onSelectDrill }}
        disabled={!onSelectDrill}
        onPress={onSelectDrill}
        style={buttonStyle(
          controlCenters.top.x,
          controlCenters.top.y,
          !onSelectDrill,
        )}
        testID="page-dial-drill"
      >
        <Icon as={Folder} size={24} style={{ color: foregroundColor }} />
      </Pressable>
      <Pressable
        accessibilityLabel={`Previous ${terms.lowercaseSingular}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.previousDisabled }}
        disabled={state.previousDisabled}
        onPress={onPrevious}
        style={buttonStyle(
          controlCenters.left.x,
          controlCenters.left.y,
          state.previousDisabled,
        )}
        testID="page-dial-previous"
      >
        <Icon as={Minus} size={24} style={{ color: foregroundColor }} />
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
          style={{
            color: "#FFFFFF",
            fontSize: Math.max(8, diameter * 0.06),
            opacity: 0.68,
          }}
        >
          {terms.plural}
        </Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: Math.max(15, diameter * 0.11),
            opacity: 1,
            lineHeight: Math.max(16, diameter * 0.115),
            fontVariant: ["tabular-nums"],
          }}
        >
          {selectedIndex >= 0 ? (selectedLabel ?? selectedIndex + 1) : "–"}
        </Text>
      </Center>
      <Pressable
        accessibilityLabel="Select performer"
        accessibilityRole="button"
        accessibilityState={{ disabled: !onSelectPerformer }}
        disabled={!onSelectPerformer}
        onPress={onSelectPerformer}
        style={buttonStyle(
          controlCenters.bottom.x,
          controlCenters.bottom.y,
          !onSelectPerformer,
        )}
        testID="page-dial-performer"
      >
        <Icon
          as={CircleUserRound}
          size={24}
          style={{ color: foregroundColor }}
        />
      </Pressable>
      <Pressable
        accessibilityLabel={`Next ${terms.lowercaseSingular}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.nextDisabled }}
        disabled={state.nextDisabled}
        onPress={onNext}
        style={buttonStyle(
          controlCenters.right.x,
          controlCenters.right.y,
          state.nextDisabled,
        )}
        testID="page-dial-next"
      >
        <Icon as={Plus} size={24} style={{ color: foregroundColor }} />
      </Pressable>
    </>
  );
}

function getDividerStyle(segment: PageDialLineSegment): ViewStyle {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  const midpointX = (segment.start.x + segment.end.x) / 2;
  const midpointY = (segment.start.y + segment.end.y) / 2;
  const rotationDegrees = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
  return {
    position: "absolute",
    left: midpointX - 0.5,
    top: midpointY - length / 2,
    width: 1,
    height: length,
    transform: [{ rotate: `${rotationDegrees}deg` }],
  };
}
