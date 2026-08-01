import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import type { FieldLivePositionState } from "@eight2five/mobile/field";

import { getLiveCoordinatePresentation } from "./coordinate-panel-state";

export function LiveCoordinateRow({ live }: { live: FieldLivePositionState }) {
  const presentation = getLiveCoordinatePresentation(live);
  const color = presentation.muted ? "rgba(255,255,255,0.58)" : "#FFFFFF";
  return (
    <VStack
      className="min-w-0 flex-1 justify-center"
      testID="live-coordinate-row"
    >
      {presentation.statusLabel ? (
        <Text
          size="xs"
          style={{ color: "rgba(255,255,255,0.54)", lineHeight: 13 }}
        >
          {presentation.statusLabel}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        selectable
        size="sm"
        style={{ color, fontVariant: ["tabular-nums"], lineHeight: 17 }}
      >
        {presentation.primary}
      </Text>
      <Text
        numberOfLines={1}
        selectable
        size="xs"
        style={{ color, fontVariant: ["tabular-nums"], lineHeight: 15 }}
      >
        {presentation.secondary}
      </Text>
    </VStack>
  );
}
