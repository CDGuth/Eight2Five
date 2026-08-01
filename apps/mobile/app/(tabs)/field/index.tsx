import { FieldScreen } from "../../../src/features/field/field-screen";
import { useFieldLivePosition } from "../../../src/pans/mobile-pans-context";

export default function FieldRoute() {
  const livePosition = useFieldLivePosition();
  return <FieldScreen livePosition={livePosition} />;
}
