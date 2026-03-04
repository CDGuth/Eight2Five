import React, { useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TestbedLayout } from "./src/components/TestbedLayout";
import { TestbedHome } from "./src/screens/TestbedHome";
import { SUBAPPS, SubappId } from "./src/subapps";

export default function App() {
  const [activeSubappId, setActiveSubappId] = useState<SubappId | null>(null);
  const [onSubBack, setOnSubBack] = useState<(() => void) | undefined>(undefined);

  const activeSubapp = useMemo(
    () => SUBAPPS.find((entry) => entry.id === activeSubappId) || null,
    [activeSubappId],
  );

  const handleExitSubapp = () => {
    setActiveSubappId(null);
    setOnSubBack(undefined);
  };

  return (
    <SafeAreaProvider>
      <TestbedLayout
        title={activeSubapp?.title}
        subtitle={activeSubapp?.description}
        onBack={activeSubapp ? handleExitSubapp : undefined}
        onSubBack={onSubBack}
      >
        {activeSubapp ? (
          <activeSubapp.Component
            onExit={handleExitSubapp}
            onSetSubBack={setOnSubBack}
          />
        ) : (
          <TestbedHome subapps={SUBAPPS} onSelect={setActiveSubappId} />
        )}
      </TestbedLayout>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
