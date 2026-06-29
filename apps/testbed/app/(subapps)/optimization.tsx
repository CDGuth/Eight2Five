import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import OptimizationTestScreen from "../../src/screens/OptimizationTest";
import { SubappRouteLayout } from "../../src/subapps/SubappRouteLayout";

export default function OptimizationSubappRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();

  const forcedViewMode = params.view === "results" ? "results" : "config";

  return (
    <SubappRouteLayout subappId="optimization" contentMode="static">
      <OptimizationTestScreen
        forcedViewMode={forcedViewMode}
        onRunComplete={() => router.setParams({ view: "results" })}
        onBackToConfiguration={() => router.setParams({ view: "config" })}
      />
    </SubappRouteLayout>
  );
}
