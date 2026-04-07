import React from "react";
import { Href, useRouter } from "expo-router";
import { TestbedHome } from "../src/screens/TestbedHome";
import { TestbedLayout } from "../src/components/TestbedLayout";
import { SUBAPPS, SubappId } from "../src/subapps";

export default function TestbedHomeRoute() {
  const router = useRouter();

  const handleSelect = (id: SubappId) => {
    const selected = SUBAPPS.find((entry) => entry.id === id);
    if (!selected) return;
    router.push(selected.href as Href);
  };

  return (
    <TestbedLayout
      title="Eight2Five Testbed"
      subtitle="Pick a testing subapp to explore"
    >
      <TestbedHome subapps={SUBAPPS} onSelect={handleSelect} />
    </TestbedLayout>
  );
}
