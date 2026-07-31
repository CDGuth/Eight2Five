import { PlaceholderScreen } from "../placeholder-screen";
import { useFieldOrientation } from "../../navigation/use-field-orientation";

export function FieldScreen() {
  useFieldOrientation();

  return (
    <PlaceholderScreen
      title="Field"
      description="Live field positioning will appear here."
    />
  );
}
