import React from "react";
import * as Clipboard from "expo-clipboard";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Text } from "@eight2five/ui/text";

import { useTestbedToast } from "../../../hooks/useTestbedToast";
import { BatchAnalysis } from "../types";

interface BatchSummaryCardProps {
  batchAnalysis: BatchAnalysis;
}

export const BatchSummaryCard = ({ batchAnalysis }: BatchSummaryCardProps) => {
  const showToast = useTestbedToast();

  const copyAnalysis = async () => {
    const text = `Batch Analysis:\nAvg Error: ${batchAnalysis.avgError.toFixed(3)}m\nAvg Time: ${batchAnalysis.avgDuration.toFixed(2)}ms`;
    await Clipboard.setStringAsync(text);
    showToast({
      title: "Copied",
      description: "Analysis copied to clipboard",
      action: "success",
    });
  };

  return (
    <Box className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <Box className="flex-row items-center justify-between border-b border-border bg-muted p-4">
        <Box>
          <Text size="sm" bold className="text-foreground">
            Summary Statistics
          </Text>
          <Text size="xs" className="mt-0.5 text-muted-foreground">
            {batchAnalysis.totalRuns} Runs Total
          </Text>
        </Box>
        <Button
          size="sm"
          accessibilityLabel="Copy analysis"
          onPress={copyAnalysis}
        >
          <ButtonText>Copy</ButtonText>
        </Button>
      </Box>

      <Box className="bg-card p-4">
        <Box className="mb-2.5 flex-row justify-between">
          <Box className="flex-1">
            <Text size="xs" bold className="font-mono text-foreground">
              Accuracy
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Avg Error: {batchAnalysis.avgError.toFixed(3)}m
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              RMSE: {batchAnalysis.rmse.toFixed(3)}m
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Std Dev: {batchAnalysis.stdDev.toFixed(3)}m
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Median: {batchAnalysis.medianError.toFixed(3)}m
            </Text>
          </Box>
          <Box className="flex-1">
            <Text size="xs" bold className="font-mono text-foreground">
              Performance
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Avg Time: {batchAnalysis.avgDuration.toFixed(2)}ms
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Avg Iter: {batchAnalysis.avgIterations.toFixed(1)}
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Min/Max: {batchAnalysis.minError.toFixed(3)}m /{" "}
              {batchAnalysis.maxError.toFixed(3)}m
            </Text>
          </Box>
        </Box>

        <Box className="mb-2.5 border-t border-border pt-2.5">
          <Text size="xs" bold className="font-mono text-foreground">
            Success Rates
          </Text>
          <Box className="flex-row justify-between">
            <Text size="xs" className="font-mono text-foreground">
              Error &lt; 1.0m: {batchAnalysis.successRate1m.toFixed(1)}%
            </Text>
            <Text size="xs" className="font-mono text-foreground">
              Error &lt; 2.0m: {batchAnalysis.successRate2m.toFixed(1)}%
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
