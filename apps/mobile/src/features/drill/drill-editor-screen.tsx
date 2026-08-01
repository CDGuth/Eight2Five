import { PlaceholderScreen } from "../placeholder-screen";
import { useDrillEditorController } from "./use-drill-editor-controller";

export function DrillEditorScreen({ drillId }: { drillId?: string }) {
  const { terms } = useDrillEditorController(drillId);
  return (
    <PlaceholderScreen
      title={drillId ? "Drill" : "Create Drill"}
      description={
        drillId
          ? `Manage this drill's ${terms.plural.toLowerCase()}.`
          : "Name the drill to begin manual entry."
      }
    />
  );
}
