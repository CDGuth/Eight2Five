import { PlaceholderScreen } from "../placeholder-screen";
import { useDrillListController } from "./use-drill-list-controller";

export function DrillListScreen() {
  const { terms } = useDrillListController();
  return (
    <PlaceholderScreen
      title="Drill"
      description={`Create or load a drill to manage ${terms.plural.toLowerCase()}.`}
    />
  );
}
