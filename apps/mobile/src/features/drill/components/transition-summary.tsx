import React from "react";
import { analyzeTransition, type DrillSet } from "@eight2five/mobile/drill";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { formatTransitionAnalysis } from "../transition-presentation";

export const TransitionSummary = React.memo(function TransitionSummary({
  previousPage,
  page,
}: {
  previousPage?: DrillSet;
  page: DrillSet;
}) {
  const theme = useEight2FiveTheme();
  const currentX = page.position.xSteps;
  const currentY = page.position.ySteps;
  const previousX = previousPage?.position.xSteps;
  const previousY = previousPage?.position.ySteps;
  const counts = page.countsFromPrevious;
  const presentation = React.useMemo(
    () =>
      formatTransitionAnalysis(
        analyzeTransition(
          previousX === undefined || previousY === undefined
            ? undefined
            : { xSteps: previousX, ySteps: previousY },
          { xSteps: currentX, ySteps: currentY },
          counts,
        ),
        previousX !== undefined && previousY !== undefined,
        counts,
      ),
    [counts, currentX, currentY, previousX, previousY],
  );

  return (
    <HStack className="flex-wrap" style={{ gap: 12 }}>
      <Text
        size="sm"
        style={{
          color: theme.textMuted,
          fontFamily: eight2FiveFonts.utilityRegular,
        }}
      >
        Step Size: {presentation.stepSize}
      </Text>
      <Text
        size="sm"
        style={{
          color: theme.textMuted,
          fontFamily: eight2FiveFonts.utilityRegular,
        }}
      >
        xCounts: {presentation.crossingCounts}
      </Text>
    </HStack>
  );
});
