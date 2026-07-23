import { Slot } from "expo-router";

import { TestbedSubappShell } from "../../src/components/TestbedSubappShell";

export default function SubappsLayout() {
  return (
    <TestbedSubappShell>
      <Slot />
    </TestbedSubappShell>
  );
}
