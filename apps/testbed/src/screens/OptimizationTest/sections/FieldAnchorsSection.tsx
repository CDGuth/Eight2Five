import React from "react";

import { ActionButton } from "../../../components/ActionButton";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { Dropdown } from "../components/Dropdown";
import { InputRow } from "../components/InputRow";
import { FIELD_PRESETS } from "../types";

interface FieldAnchorsSectionProps {
  fieldPreset: string;
  onPresetChange: (v: string) => void;
  inputWidth: string;
  setInputWidth: (v: string) => void;
  inputLength: string;
  setInputLength: (v: string) => void;
  setFieldWidth: (v: number) => void;
  setFieldLength: (v: number) => void;
  numAnchors: string;
  setNumAnchors: (v: string) => void;
  anchorPlacementMode: string;
  setAnchorPlacementMode: (v: string) => void;
  anchorSigma: string;
  setAnchorSigma: (v: string) => void;
  onGenerateAnchors: () => void;
  onToggleScroll: (open: boolean) => void;
}

export function FieldAnchorsSection({
  fieldPreset,
  onPresetChange,
  inputWidth,
  setInputWidth,
  inputLength,
  setInputLength,
  setFieldWidth,
  setFieldLength,
  numAnchors,
  setNumAnchors,
  anchorPlacementMode,
  setAnchorPlacementMode,
  anchorSigma,
  setAnchorSigma,
  onGenerateAnchors,
  onToggleScroll,
}: FieldAnchorsSectionProps) {
  return (
    <CollapsibleSection title="Field & Anchors">
      <Dropdown
        label="Field Preset"
        value={fieldPreset}
        options={FIELD_PRESETS}
        onSelect={onPresetChange}
        onToggle={onToggleScroll}
        tooltip="Quickly set the field dimensions and anchor configuration based on common scenarios (e.g. standard field or custom presets)."
      />
      <InputRow
        label="Width (m)"
        value={inputWidth}
        onChange={setInputWidth}
        tooltip="The width of the practice field in meters. This defines the X-axis bounds for localization."
      />
      <InputRow
        label="Length (m)"
        value={inputLength}
        onChange={setInputLength}
        tooltip="The length of the practice field in meters. This defines the Y-axis bounds for localization."
      />
      <ActionButton
        onPress={() => {
          setFieldWidth(parseFloat(inputWidth));
          setFieldLength(parseFloat(inputLength));
        }}
        className="mb-3"
      >
        Resize Field
      </ActionButton>
      <InputRow
        label="Number of Anchors"
        value={numAnchors}
        onChange={setNumAnchors}
        tooltip="Total number of beacons to simulate on the field. More anchors generally improve accuracy but increase computational load."
      />
      <Dropdown
        label="Anchor Placement"
        value={anchorPlacementMode}
        options={[
          { label: "Border", value: "border" },
          { label: "Grid", value: "grid" },
          { label: "Random", value: "random" },
        ]}
        onSelect={setAnchorPlacementMode}
        onToggle={onToggleScroll}
        tooltip="Determines the spatial distribution of anchors. 'Grid' is often best for coverage, while 'Border' simulates perimeter-only setups."
      />
      <InputRow
        label="Anchor Sigma (m)"
        value={anchorSigma}
        onChange={setAnchorSigma}
        tooltip="The standard deviation of random error added to anchor positions during generation. Increase this to simulate field setup inaccuracies. Even small values (0.1m - 0.5m) can significantly impact localization accuracy."
      />
      <ActionButton onPress={onGenerateAnchors} className="mt-3">
        Generate Anchors
      </ActionButton>
    </CollapsibleSection>
  );
}
