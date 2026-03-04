import React from "react";
import OptimizationTestScreen from "../screens/OptimizationTest";

export type SubappId = "optimization";

export interface TestbedSubapp {
  id: SubappId;
  title: string;
  description: string;
  badge?: string;
  Component: React.ComponentType<{
    onExit?: () => void;
    onSetSubBack?: (cb: (() => void) | undefined) => void;
  }>;
}

export const SUBAPPS: TestbedSubapp[] = [
  {
    id: "optimization",
    title: "Optimization Test",
    description:
      "Experiment with optimization-based localization, propagation constants, noise models, and variable sweep runs.",
    Component: OptimizationTestScreen,
  },
];
