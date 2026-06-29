import React from "react";
import * as Clipboard from "expo-clipboard";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Text } from "@eight2five/ui/text";

import { useTestbedToast } from "../../../hooks/useTestbedToast";
import { RunResult } from "../types";

interface RunDetailsCardProps {
  result: RunResult;
}

export const RunDetailsCard = ({ result }: RunDetailsCardProps) => {
  const showToast = useTestbedToast();

  const copyDetails = async () => {
    const text = [
      `Run ${result.id}`,
      `Error: ${result.error.toFixed(3)}m`,
      `True Pos: (${result.truePos.x.toFixed(2)}, ${result.truePos.y.toFixed(2)})`,
      `Est Pos: (${result.estPos.x.toFixed(2)}, ${result.estPos.y.toFixed(2)})`,
      `Source Mode: ${result.sourceMode ?? "ble-rssi"}`,
      `Measurement Kinds: ${(result.measurementKinds ?? ["rssi"]).join(", ")}`,
    ].join("\n");
    await Clipboard.setStringAsync(text);
    showToast({
      title: "Copied",
      description: "Run details copied to clipboard",
      action: "success",
    });
  };

  return (
    <Box className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <Box className="flex-row items-center justify-between border-b border-border bg-muted p-4">
        <Box>
          <Text size="sm" bold className="text-foreground">
            Run Details
          </Text>
          <Text size="xs" className="mt-0.5 text-muted-foreground">
            Run {result.id}
          </Text>
        </Box>
        <Button
          size="sm"
          accessibilityLabel="Copy run details"
          onPress={copyDetails}
        >
          <ButtonText>Copy</ButtonText>
        </Button>
      </Box>

      <Box className="bg-card p-4">
        <Text size="xs" className="font-mono text-foreground">
          Error: {result.error.toFixed(3)}m
        </Text>
        <Text size="xs" className="font-mono text-foreground">
          True Pos: ({result.truePos.x.toFixed(2)},{" "}
          {result.truePos.y.toFixed(2)})
        </Text>
        <Text size="xs" className="font-mono text-foreground">
          Est Pos: ({result.estPos.x.toFixed(2)}, {result.estPos.y.toFixed(2)})
        </Text>
        <Text size="xs" className="font-mono text-foreground">
          Source Mode: {result.sourceMode ?? "ble-rssi"}
        </Text>
        <Text size="xs" className="font-mono text-foreground">
          Measurement Kinds: {(result.measurementKinds ?? ["rssi"]).join(", ")}
        </Text>
      </Box>
    </Box>
  );
};
