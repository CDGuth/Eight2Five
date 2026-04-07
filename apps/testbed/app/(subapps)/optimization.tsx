import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import OptimizationTestScreen from "../../src/screens/OptimizationTest";
import { TestbedLayout } from "../../src/components/TestbedLayout";

export default function OptimizationSubappRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();

  const forcedViewMode = params.view === "results" ? "results" : "config";

  return (
    <TestbedLayout
      title="Optimization Test"
      subtitle="Experiment with optimization-based localization, propagation constants, and noise models."
    >
      <OptimizationTestScreen
        forcedViewMode={forcedViewMode}
        onRunComplete={() => router.setParams({ view: "results" })}
        onBackToConfiguration={() => router.setParams({ view: "config" })}
      />
    </TestbedLayout>
  );
}
