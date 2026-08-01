import React from "react";
import { analyzeTransition, type DrillPage } from "@eight2five/mobile/drill";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";

import { formatTransitionAnalysis } from "../transition-presentation";

export const TransitionSummary = React.memo(function TransitionSummary({
  previousPage,
  page,
}: {
  previousPage?: DrillPage;
  page: DrillPage;
}) {
  const theme = useEight2FiveTheme();
  const currentX = page.position.xMeters;
  const currentY = page.position.yMeters;
  const previousX = previousPage?.position.xMeters;
  const previousY = previousPage?.position.yMeters;
  const counts = page.countsFromPrevious;
  const presentation = React.useMemo(
    () =>
      formatTransitionAnalysis(
        analyzeTransition(
          previousX === undefined || previousY === undefined
            ? undefined
            : { xMeters: previousX, yMeters: previousY },
          { xMeters: currentX, yMeters: currentY },
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
