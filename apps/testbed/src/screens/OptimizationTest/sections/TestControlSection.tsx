import React from "react";
import { Box } from "@eight2five/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@eight2five/ui/button";

import { ActionButton } from "../../../components/ActionButton";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { Dropdown } from "../components/Dropdown";
import { InputRow } from "../components/InputRow";

interface SweepConfig {
  param: string;
  min: string;
  max: string;
  step: string;
  runsPerStep: string;
}

interface TestControlSectionProps {
  sourceMode: string;
  setSourceMode: (v: string) => void;
  uwbDistanceSigma: string;
  setUwbDistanceSigma: (v: string) => void;
  testMode: string;
  setTestMode: (v: string) => void;
  numRuns: string;
  setNumRuns: (v: string) => void;
  iterationTimeLimit: string;
  setIterationTimeLimit: (v: string) => void;
  sweepConfig: SweepConfig;
  setSweepConfig: (config: SweepConfig) => void;
  isRunning: boolean;
  onRun: () => void;
  onToggleScroll: (open: boolean) => void;
}

export function TestControlSection({
  sourceMode,
  setSourceMode,
  uwbDistanceSigma,
  setUwbDistanceSigma,
  testMode,
  setTestMode,
  numRuns,
  setNumRuns,
  iterationTimeLimit,
  setIterationTimeLimit,
  sweepConfig,
  setSweepConfig,
  isRunning,
  onRun,
  onToggleScroll,
}: TestControlSectionProps) {
  return (
    <CollapsibleSection title="Test Configuration & Control">
      <Dropdown
        label="Simulation Source"
        value={sourceMode}
        options={[
          { label: "BLE RSSI", value: "ble-rssi" },
          { label: "UWB Distance", value: "uwb-distance" },
          { label: "Hybrid (BLE + UWB)", value: "hybrid" },
        ]}
        onSelect={setSourceMode}
        onToggle={onToggleScroll}
        disabled={isRunning}
        tooltip="Choose the measurement source used for simulation runs. Hybrid mode feeds both RSSI and distance observations into the optimizer."
      />
      {sourceMode !== "ble-rssi" && (
        <InputRow
          label="UWB Sigma (m)"
          value={uwbDistanceSigma}
          onChange={setUwbDistanceSigma}
          disabled={isRunning}
          tooltip="Standard deviation applied to simulated UWB distance measurements in meters. Lower values approximate cleaner LOS measurements."
        />
      )}
      <Dropdown
        label="Test Mode"
        value={testMode}
        options={[
          { label: "Standard", value: "standard" },
          { label: "Parameter Sweep", value: "sweep" },
        ]}
        onSelect={setTestMode}
        onToggle={onToggleScroll}
        disabled={isRunning}
      />
      {testMode === "standard" ? (
        <>
          <InputRow
            label="Number of Runs"
            value={numRuns}
            onChange={setNumRuns}
            disabled={isRunning}
            tooltip="The number of simulations to run for this test. Results will be averaged in the analysis view."
          />
          <InputRow
            label="Iteration Time Limit (ms)"
            value={iterationTimeLimit}
            onChange={setIterationTimeLimit}
            disabled={isRunning}
            tooltip="The maximum time allowed for each iteration step (ms). This ensures the UI remains responsive during optimization. Increase this for faster convergence on powerful devices."
          />
        </>
      ) : (
        <>
          <Dropdown
            label="Sweep Parameter"
            value={sweepConfig.param}
            options={[
              {
                label: "Iteration Time Limit",
                value: "iterationTimeLimitMs",
              },
              { label: "Max Iterations", value: "maxIterations" },
              { label: "Population Size", value: "populationSize" },
              { label: "Beta0", value: "beta0" },
              { label: "Light Absorption", value: "lightAbsorption" },
              { label: "Alpha", value: "alpha" },
              { label: "Initial Temp", value: "initialTemperature" },
              { label: "Cooling Rate", value: "coolingRate" },
              {
                label: "Solver Weighting Base",
                value: "solverWeightingBase",
              },
              {
                label: "Solver Weighting Scale",
                value: "solverWeightingScale",
              },
              {
                label: "Solver Weighting Param",
                value: "solverWeightingParam",
              },
            ]}
            onSelect={(v) => setSweepConfig({ ...sweepConfig, param: v })}
            onToggle={onToggleScroll}
            disabled={isRunning}
          />
          <InputRow
            label="Min"
            value={sweepConfig.min}
            onChange={(v) => setSweepConfig({ ...sweepConfig, min: v })}
            disabled={isRunning}
          />
          <InputRow
            label="Max"
            value={sweepConfig.max}
            onChange={(v) => setSweepConfig({ ...sweepConfig, max: v })}
            disabled={isRunning}
          />
          <InputRow
            label="Runs Per Step"
            value={sweepConfig.runsPerStep}
            onChange={(v) =>
              setSweepConfig({
                ...sweepConfig,
                runsPerStep: v,
              })
            }
            disabled={isRunning}
          />
          <InputRow
            label="Step"
            value={sweepConfig.step}
            onChange={(v) => setSweepConfig({ ...sweepConfig, step: v })}
            disabled={isRunning}
          />
        </>
      )}
      <Box className="my-5 items-center">
        {isRunning ? (
          <Button isDisabled>
            <ButtonSpinner />
            <ButtonText>Running</ButtonText>
          </Button>
        ) : (
          <ActionButton className="w-full" onPress={onRun}>
            Run Optimization Test
          </ActionButton>
        )}
      </Box>
    </CollapsibleSection>
  );
}
