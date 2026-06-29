import React, { useRef } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Text } from "@eight2five/ui/text";

import { SweepGraph } from "./SweepGraph";
import { useTestbedToast } from "../../../hooks/useTestbedToast";
import { SweepConfig, SweepStepResult } from "../types";

interface SweepResultsCardProps {
  sweepResults: SweepStepResult[];
  sweepConfig: SweepConfig;
  selectedSweepIndex: number | null;
  onSelectPoint: (index: number) => void;
}

export const SweepResultsCard = ({
  sweepResults,
  sweepConfig,
  selectedSweepIndex,
  onSelectPoint,
}: SweepResultsCardProps) => {
  const graphRef = useRef<View>(null);
  const showToast = useTestbedToast();

  const copyGraph = async () => {
    try {
      const base64 = await captureRef(graphRef, {
        format: "png",
        quality: 0.8,
        result: "base64",
      });
      await Clipboard.setImageAsync(base64);
      showToast({
        title: "Copied",
        description: "Graph copied to clipboard",
        action: "success",
      });
    } catch (e) {
      console.error(e);
      showToast({
        title: "Error",
        description: "Failed to copy graph",
        action: "error",
      });
    }
  };

  return (
    <Box className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <Box className="flex-row items-center justify-between border-b border-border bg-muted p-4">
        <Text size="sm" bold className="text-foreground">
          Parameter Sweep
        </Text>
        <Button size="sm" accessibilityLabel="Copy graph" onPress={copyGraph}>
          <ButtonText>Copy Graph</ButtonText>
        </Button>
      </Box>

      <Box className="bg-card p-4">
        <Box ref={graphRef} collapsable={false} className="bg-muted">
          <SweepGraph
            results={sweepResults}
            paramName={sweepConfig.param}
            selectedIndex={selectedSweepIndex}
            onSelectPoint={onSelectPoint}
          />
        </Box>
      </Box>
    </Box>
  );
};
