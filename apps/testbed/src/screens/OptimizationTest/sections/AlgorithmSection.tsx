import React from "react";
import { Divider } from "@eight2five/ui/divider";

import { ActionButton } from "../../../components/ActionButton";
import { SectionLabel } from "../../../components/SectionLabel";
import { ToggleRow } from "../../../components/ToggleRow";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { Dropdown } from "../components/Dropdown";
import { InputRow } from "../components/InputRow";

interface AlgorithmSectionProps {
  selectedAlgorithm: string;
  setSelectedAlgorithm: (v: string) => void;
  populationSize: string;
  setPopulationSize: (v: string) => void;
  maxIterations: string;
  setMaxIterations: (v: string) => void;
  beta0: string;
  setBeta0: (v: string) => void;
  lightAbsorption: string;
  setLightAbsorption: (v: string) => void;
  alpha: string;
  setAlpha: (v: string) => void;
  initialTemperature: string;
  setInitialTemperature: (v: string) => void;
  coolingRate: string;
  setCoolingRate: (v: string) => void;
  isSolverWeighted: boolean;
  setIsSolverWeighted: (v: boolean) => void;
  solverWeightingModel: string;
  setSolverWeightingModel: (v: string) => void;
  solverWeightingBase: string;
  setSolverWeightingBase: (v: string) => void;
  solverWeightingScale: string;
  setSolverWeightingScale: (v: string) => void;
  solverWeightingParam: string;
  setSolverWeightingParam: (v: string) => void;
  isRegenerateFirefliesEveryRun: boolean;
  setIsRegenerateFirefliesEveryRun: (v: boolean) => void;
  fireflyPlacementMode: string;
  setFireflyPlacementMode: (v: string) => void;
  fireflySigma: string;
  setFireflySigma: (v: string) => void;
  onGenerateFireflies: () => void;
  isRunning: boolean;
  onToggleScroll: (open: boolean) => void;
}

export function AlgorithmSection({
  selectedAlgorithm,
  setSelectedAlgorithm,
  populationSize,
  setPopulationSize,
  maxIterations,
  setMaxIterations,
  beta0,
  setBeta0,
  lightAbsorption,
  setLightAbsorption,
  alpha,
  setAlpha,
  initialTemperature,
  setInitialTemperature,
  coolingRate,
  setCoolingRate,
  isSolverWeighted,
  setIsSolverWeighted,
  solverWeightingModel,
  setSolverWeightingModel,
  solverWeightingBase,
  setSolverWeightingBase,
  solverWeightingScale,
  setSolverWeightingScale,
  solverWeightingParam,
  setSolverWeightingParam,
  isRegenerateFirefliesEveryRun,
  setIsRegenerateFirefliesEveryRun,
  fireflyPlacementMode,
  setFireflyPlacementMode,
  fireflySigma,
  setFireflySigma,
  onGenerateFireflies,
  isRunning,
  onToggleScroll,
}: AlgorithmSectionProps) {
  return (
    <CollapsibleSection title="Algorithm">
      <Dropdown
        label="Algorithm"
        value={selectedAlgorithm}
        options={[{ label: "MFASA", value: "MFASA" }]}
        onSelect={setSelectedAlgorithm}
        onToggle={onToggleScroll}
        tooltip="The optimization algorithm used to solve for X,Y coordinates. MFASA is a Memetic Firefly Algorithm combined with Simulated Annealing."
      />
      <InputRow
        label="Population Size"
        value={populationSize}
        onChange={setPopulationSize}
        tooltip="The number of candidate fireflies. Larger populations (50+) explore the search space better but slow down execution."
      />
      <InputRow
        label="Max Iterations"
        value={maxIterations}
        onChange={setMaxIterations}
        tooltip="The maximum iterations for the optimization. Increase this for better precision, especially when Alpha is low."
      />
      <InputRow
        label="Beta0"
        value={beta0}
        onChange={setBeta0}
        tooltip="Attractiveness at distance 0. Controls how strongly fireflies are attracted to brighter ones. Lower values (1-2) prevent early convergence; higher values (3+) make the algorithm more aggressive but risk local minima."
      />
      <InputRow
        label="Light Absorption"
        value={lightAbsorption}
        onChange={setLightAbsorption}
        tooltip="Controls how quickly attractiveness decreases with distance. High values (0.5+) mean local search around better fireflies; low values (0.01-0.1) mean global search. Tune this based on field size - larger fields often need lower values."
      />
      <InputRow
        label="Alpha"
        value={alpha}
        onChange={setAlpha}
        tooltip="Randomization parameter. Controls the randomness of movement. Start with 0.2. Decrease this as you increase max iterations to let the fireflies 'settle' into the solution."
      />
      <InputRow
        label="Initial Temperature"
        value={initialTemperature}
        onChange={setInitialTemperature}
        tooltip="Starting temperature for Simulated Annealing. Higher means more random movement initially to help escape local minima. Try 10-20 for high-noise environments."
      />
      <InputRow
        label="Cooling Rate"
        value={coolingRate}
        onChange={setCoolingRate}
        tooltip="How fast the temperature decreases (0-1). Closer to 1 means slower cooling and more exhaustive exploration. Faster cooling (0.8-0.9) speed up convergence but might be less accurate."
      />

      <Divider className="my-4" />

      <SectionLabel>Solver Weighting</SectionLabel>
      <ToggleRow
        label="Enable Weighted Solver"
        isChecked={isSolverWeighted}
        onChange={setIsSolverWeighted}
        disabled={isRunning}
      />

      {isSolverWeighted && (
        <Dropdown
          label="Weighting Model"
          value={solverWeightingModel}
          options={[
            { label: "Linear", value: "linear" },
            { label: "Inverse RSSI", value: "inverse-rssi" },
          ]}
          onSelect={setSolverWeightingModel}
          onToggle={onToggleScroll}
        />
      )}

      {isSolverWeighted && (
        <>
          {solverWeightingModel === "linear" && (
            <InputRow
              label="Weighting Base"
              value={solverWeightingBase}
              onChange={setSolverWeightingBase}
              tooltip="The base value added to RSSI for linear weighting (e.g. 120). This ensures the weights are positive. Higher values make the weights more uniform across different RSSI levels; lower values (closer to the absolute max RSSI) emphasize strong signals more heavily."
            />
          )}
          <InputRow
            label="Weighting Scale"
            value={solverWeightingScale}
            onChange={setSolverWeightingScale}
            tooltip="Multiplicative scale factor for the calculated weight. Use this to amplify the effect of weighting in the objective function. Higher values (~5-10) can help the optimizer prioritize high-quality signals more aggressively."
          />
          {solverWeightingModel !== "linear" && (
            <InputRow
              label="Curvature (Param)"
              value={solverWeightingParam}
              onChange={setSolverWeightingParam}
              tooltip="Power parameter for inverse weighting models. At 1.0, weighting is inverse; at 2.0, it becomes inverse-squared. Increase this (>2.0) to exponentially favor fireflies near the strongest anchors, which is useful when noise increases heavily with distance."
            />
          )}
        </>
      )}

      <Divider className="my-4" />

      <SectionLabel>Initial Population</SectionLabel>
      <ToggleRow
        label="Regenerate Every Run"
        isChecked={isRegenerateFirefliesEveryRun}
        onChange={setIsRegenerateFirefliesEveryRun}
        disabled={isRunning}
      />

      <Dropdown
        label="Firefly Placement"
        value={fireflyPlacementMode}
        options={[
          { label: "Border", value: "border" },
          { label: "Grid", value: "grid" },
          { label: "Random", value: "random" },
        ]}
        onSelect={setFireflyPlacementMode}
        onToggle={onToggleScroll}
        tooltip="Determines how the initial firefly population is scattered. 'Grid' or 'Border' can provide a systematic starting coverage, while 'Random' is standard."
      />
      <InputRow
        label="Firefly Sigma (m)"
        value={fireflySigma}
        onChange={setFireflySigma}
        tooltip="The standard deviation of random error added to initial firefly positions during generation."
      />
      {!isRegenerateFirefliesEveryRun && (
        <ActionButton onPress={onGenerateFireflies} className="mt-3">
          Generate Fireflies
        </ActionButton>
      )}
    </CollapsibleSection>
  );
}
