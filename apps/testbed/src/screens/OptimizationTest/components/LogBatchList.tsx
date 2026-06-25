import React from "react";
import { Alert, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Text } from "@eight2five/ui/text";

import { ScrollLockView } from "./ScrollLockView";
import { LogBatch } from "../types";

interface LogBatchListProps {
  logBatches: LogBatch[];
  onClearLogs: () => void;
  onToggleScroll?: (enabled: boolean) => void;
}

export const LogBatchList = ({
  logBatches,
  onClearLogs,
  onToggleScroll,
}: LogBatchListProps) => {
  const copyBatch = async (batch: LogBatch) => {
    const text = batch.entries
      .map(
        (e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.message}`,
      )
      .join("\n");
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", "Logs copied to clipboard");
  };

  return (
    <>
      <Button
        variant="destructive"
        accessibilityLabel="Clear logs"
        onPress={onClearLogs}
        className="mb-4 flex-1"
      >
        <ButtonText>Clear Logs</ButtonText>
      </Button>

      {logBatches.map((batch) => (
        <Box
          key={batch.id}
          className="mb-4 overflow-hidden rounded-lg border border-border bg-card"
        >
          <Box className="flex-row items-center justify-between border-b border-border bg-muted p-4">
            <Box>
              <Text size="sm" bold className="text-foreground">
                {batch.type} Run
              </Text>
              <Text size="xs" className="mt-0.5 text-muted-foreground">
                {new Date(batch.startTime).toLocaleString()}
              </Text>
            </Box>
            <Button
              size="sm"
              accessibilityLabel="Copy log batch"
              onPress={() => copyBatch(batch)}
            >
              <ButtonText>Copy</ButtonText>
            </Button>
          </Box>

          <ScrollLockView onToggleScroll={onToggleScroll}>
            <ScrollView
              nestedScrollEnabled
              className="max-h-[300px] bg-card p-4"
            >
              {batch.entries.map((e, i) => (
                <Text
                  key={i}
                  size="xs"
                  className="mb-0.5 font-mono text-foreground"
                >
                  <Text size="xs" className="text-muted-foreground">
                    [{new Date(e.timestamp).toLocaleTimeString()}]
                  </Text>{" "}
                  {e.message}
                </Text>
              ))}
            </ScrollView>
          </ScrollLockView>
        </Box>
      ))}
    </>
  );
};
