import React from "react";
import { useRouter } from "expo-router";
import { TestbedHome } from "../src/screens/TestbedHome";
import { TestbedLayout } from "../src/components/TestbedLayout";
import { getSubappById, SUBAPPS, SubappId } from "../src/subapps";

export default function TestbedHomeRoute() {
  const router = useRouter();

  const handleSelect = (id: SubappId) => {
    router.push(getSubappById(id).href);
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
