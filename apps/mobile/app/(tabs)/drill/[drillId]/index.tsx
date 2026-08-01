import { useLocalSearchParams } from "expo-router";

import { DrillEditorScreen } from "../../../../src/features/drill/drill-editor-screen";

export default function ExistingDrillRoute() {
  const { drillId } = useLocalSearchParams<{ drillId: string }>();
  return <DrillEditorScreen drillId={drillId} />;
}
