import React from "react";

import { ToggleRow } from "../../../components/ToggleRow";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { InputRow } from "../components/InputRow";

interface TruePosition {
  x: number;
  y: number;
}

interface TruePositionSectionProps {
  isRandomTruePos: boolean;
  setIsRandomTruePos: (v: boolean) => void;
  isRunning: boolean;
  manualTrueX: string;
  setManualTrueX: (v: string) => void;
  manualTrueY: string;
  setManualTrueY: (v: string) => void;
  currentTruePos: TruePosition;
  setCurrentTruePos: (pos: TruePosition) => void;
}

export function TruePositionSection({
  isRandomTruePos,
  setIsRandomTruePos,
  isRunning,
  manualTrueX,
  setManualTrueX,
  manualTrueY,
  setManualTrueY,
  currentTruePos,
  setCurrentTruePos,
}: TruePositionSectionProps) {
  return (
    <CollapsibleSection title="True Position">
      <ToggleRow
        label="Randomly Select True Position"
        isChecked={isRandomTruePos}
        onChange={setIsRandomTruePos}
        disabled={isRunning}
      />

      {!isRandomTruePos && (
        <>
          <InputRow
            label="True X (m)"
            value={manualTrueX}
            onChange={(v) => {
              setManualTrueX(v);
              setCurrentTruePos({
                ...currentTruePos,
                x: parseFloat(v) || 0,
              });
            }}
            disabled={isRunning}
            tooltip="Manually set the true X coordinate of the performer. This will be used as the ground truth for error calculation."
          />
          <InputRow
            label="True Y (m)"
            value={manualTrueY}
            onChange={(v) => {
              setManualTrueY(v);
              setCurrentTruePos({
                ...currentTruePos,
                y: parseFloat(v) || 0,
              });
            }}
            disabled={isRunning}
            tooltip="Manually set the true Y coordinate of the performer. This will be used as the ground truth for error calculation."
          />
        </>
      )}
    </CollapsibleSection>
  );
}
