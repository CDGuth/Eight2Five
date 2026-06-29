import React, { useMemo, useState } from "react";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Pressable } from "@eight2five/ui/pressable";
import { ScrollView } from "@eight2five/ui/scroll-view";
import { Text } from "@eight2five/ui/text";

import { ScrollLockView } from "./ScrollLockView";
import {
  BatchAnalysis,
  RunResult,
  SweepConfig,
  SweepStepResult,
} from "../types";

interface BestRunsListProps {
  results: RunResult[];
  sweepResults: SweepStepResult[];
  batchAnalysis: BatchAnalysis | null;
  sweepConfig: SweepConfig;
  testMode: string;
  onSelectResultIndex: (index: number) => void;
  onSelectSweepIndex: (index: number | null) => void;
  onToggleScroll?: (enabled: boolean) => void;
}

export const BestRunsList = ({
  results,
  sweepResults,
  batchAnalysis,
  sweepConfig,
  testMode,
  onSelectResultIndex,
  onSelectSweepIndex,
  onToggleScroll,
}: BestRunsListProps) => {
  const [showBestAverages, setShowBestAverages] = useState(false);

  const bestItems = useMemo(() => {
    if (showBestAverages && sweepResults.length > 0) {
      return [...sweepResults]
        .sort((a, b) => a.avgError - b.avgError)
        .slice(0, 50)
        .map((s, i) => ({
          label: `${i + 1}. ${sweepConfig.param}=${s.val.toFixed(2)}: Avg Err ${s.avgError.toFixed(3)}m`,
          onPress: () => {
            const idx = sweepResults.findIndex((sr) => sr.val === s.val);
            onSelectSweepIndex(idx);
            if (s.runs.length > 0) {
              const rId = s.runs[0].id;
              const rIdx = results.findIndex((r) => r.id === rId);
              if (rIdx !== -1) onSelectResultIndex(rIdx);
            }
          },
        }));
    }
    return (
      batchAnalysis?.bestRuns.map((r, i) => ({
        label: `${i + 1}. Run ${r.id}: ${r.error.toFixed(3)}m (${r.duration.toFixed(1)}ms)`,
        onPress: () => {
          const idx = results.findIndex((res) => res.id === r.id);
          if (idx !== -1) onSelectResultIndex(idx);
        },
      })) || []
    );
  }, [
    showBestAverages,
    sweepResults,
    batchAnalysis,
    sweepConfig.param,
    results,
    onSelectResultIndex,
    onSelectSweepIndex,
  ]);

  return (
    <Box className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <Box className="flex-row items-center justify-between border-b border-border bg-muted p-4">
        <Text size="sm" bold className="text-foreground">
          Best Runs
        </Text>
        {testMode === "sweep" && (
          <Button
            size="sm"
            accessibilityLabel="Toggle averages"
            onPress={() => setShowBestAverages(!showBestAverages)}
          >
            <ButtonText>
              {showBestAverages ? "Show Individual" : "Show Averages"}
            </ButtonText>
          </Button>
        )}
      </Box>

      <Box className="bg-card p-4">
        <ScrollLockView
          onToggleScroll={onToggleScroll}
          className="mt-1 max-h-[180px] rounded border border-border bg-muted"
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            className="p-[5px]"
          >
            {bestItems.map((item, i) => (
              <Pressable
                key={i}
                onPress={item.onPress}
                accessibilityLabel={`Best run ${i + 1}`}
              >
                <Text size="xs" className="font-mono text-muted-foreground">
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScrollLockView>
      </Box>
    </Box>
  );
};
