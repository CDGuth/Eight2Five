import React from "react";
import { View } from "react-native";
import { Button, ButtonSpinner, ButtonText } from "@eight2five/ui/button";
import { HStack } from "@eight2five/ui/hstack";
import { Heading } from "@eight2five/ui/heading";
import { Progress, ProgressFilledTrack } from "@eight2five/ui/progress";
import { VStack } from "@eight2five/ui/vstack";

import { Visualization } from "../components/Visualization";
import { styles } from "../styles";
import { RunResult } from "../types";

interface VisualizationSectionProps {
  visualizationRef: React.RefObject<View | null>;
  fieldWidth: number;
  fieldLength: number;
  result?: RunResult;
  currentAnchors: Parameters<typeof Visualization>[0]["currentAnchors"];
  currentTruePos: Parameters<typeof Visualization>[0]["currentTruePos"];
  currentInitialFireflies: Parameters<
    typeof Visualization
  >[0]["currentInitialFireflies"];
  onUpdateTruePos: (x: number, y: number) => void;
  onUpdateAnchor: (index: number, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isRandomTruePos: boolean;
  isRunning: boolean;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  isSetup: boolean;
  isCapturing: boolean;
  useWhiteBackground: boolean;
  heatmapResolution: string;
  onResolutionChange: (value: string) => void;
  progress: number;
  onCopyImage: () => void;
  onCancelRun: () => void;
}

export function VisualizationSection({
  visualizationRef,
  fieldWidth,
  fieldLength,
  result,
  currentAnchors,
  currentTruePos,
  currentInitialFireflies,
  onUpdateTruePos,
  onUpdateAnchor,
  onDragStart,
  onDragEnd,
  isRandomTruePos,
  isRunning,
  showHeatmap,
  onToggleHeatmap,
  isSetup,
  isCapturing,
  useWhiteBackground,
  heatmapResolution,
  onResolutionChange,
  progress,
  onCopyImage,
  onCancelRun,
}: VisualizationSectionProps) {
  return (
    <VStack className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
      <HStack className="items-center justify-between border-b border-border bg-muted p-4">
        <Heading size="sm" className="text-primary">
          Visualization
        </Heading>
        {!isRunning && (
          <Button size="sm" onPress={onCopyImage} isDisabled={isCapturing}>
            {isCapturing ? <ButtonSpinner /> : null}
            <ButtonText>Copy Image</ButtonText>
          </Button>
        )}
      </HStack>
      <View
        ref={visualizationRef}
        collapsable={false}
        style={[
          styles.sectionContent,
          useWhiteBackground && { backgroundColor: "#fff" },
        ]}
      >
        <Visualization
          width={fieldWidth}
          length={fieldLength}
          result={result ?? null}
          currentAnchors={currentAnchors}
          currentTruePos={currentTruePos}
          currentInitialFireflies={currentInitialFireflies}
          onUpdateTruePos={onUpdateTruePos}
          onUpdateAnchor={onUpdateAnchor}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isRandomTruePos={isRandomTruePos}
          isRunning={isRunning}
          showHeatmap={showHeatmap}
          onToggleHeatmap={onToggleHeatmap}
          isSetup={isSetup}
          hideControls={isCapturing}
          useWhiteBackground={useWhiteBackground}
          heatmapResolution={heatmapResolution}
          onResolutionChange={onResolutionChange}
        />
        {isRunning && (
          <VStack space="md" className="mt-5">
            <Progress value={progress * 100}>
              <ProgressFilledTrack />
            </Progress>
            <Button variant="destructive" onPress={onCancelRun}>
              <ButtonText>CANCEL RUN</ButtonText>
            </Button>
          </VStack>
        )}
      </View>
    </VStack>
  );
}
