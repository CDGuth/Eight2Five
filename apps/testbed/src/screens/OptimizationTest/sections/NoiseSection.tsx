import React from "react";

import { ToggleRow } from "../../../components/ToggleRow";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { Dropdown } from "../components/Dropdown";
import { InputRow } from "../components/InputRow";

interface NoiseSectionProps {
  isNoiseEnabled: boolean;
  setIsNoiseEnabled: (v: boolean) => void;
  isRunning: boolean;
  noiseWeightingModel: string;
  setNoiseWeightingModel: (v: string) => void;
  noiseBase: string;
  setNoiseBase: (v: string) => void;
  noiseScale: string;
  setNoiseScale: (v: string) => void;
  noiseParameter: string;
  setNoiseParameter: (v: string) => void;
  onToggleScroll: (open: boolean) => void;
}

export function NoiseSection({
  isNoiseEnabled,
  setIsNoiseEnabled,
  isRunning,
  noiseWeightingModel,
  setNoiseWeightingModel,
  noiseBase,
  setNoiseBase,
  noiseScale,
  setNoiseScale,
  noiseParameter,
  setNoiseParameter,
  onToggleScroll,
}: NoiseSectionProps) {
  return (
    <CollapsibleSection title="Simulation Noise">
      <ToggleRow
        label="Enable Noise"
        isChecked={isNoiseEnabled}
        onChange={setIsNoiseEnabled}
        disabled={isRunning}
      />

      {isNoiseEnabled && (
        <Dropdown
          label="Noise Model"
          value={noiseWeightingModel}
          options={[
            { label: "Linear (Default)", value: "linear" },
            { label: "Logarithmic", value: "logarithmic" },
            { label: "Exponential", value: "exponential" },
          ]}
          onSelect={setNoiseWeightingModel}
          onToggle={onToggleScroll}
        />
      )}

      {isNoiseEnabled && (
        <>
          <InputRow
            label="Base Sigma (dBm)"
            value={noiseBase}
            onChange={setNoiseBase}
            tooltip="The base noise level at 0 distance. Typical values are 2.0-4.0 dBm. This represents environment noise floor and hardware inconsistencies."
          />
          <InputRow
            label="Noise Scale"
            value={noiseScale}
            onChange={setNoiseScale}
            tooltip="Scaling factor for the distance-dependent noise term. Typical values (0.05-0.1) represent how signal variance increases as the device moves further from an anchor."
          />
          {noiseWeightingModel !== "linear" && (
            <InputRow
              label="Model Parameter"
              value={noiseParameter}
              onChange={setNoiseParameter}
              tooltip="Additional parameter for Logarithmic (multiplier) or Exponential (divisor) models. Logarithmic: increase for steeper growth. Exponential: decrease to make noise explode faster at range."
            />
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
