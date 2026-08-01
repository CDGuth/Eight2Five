import { FieldScreen } from "../../../src/features/field/field-screen";
import { useFieldAnchorOverlay } from "../../../src/features/field/use-field-anchor-overlay";
import { useFieldLivePosition } from "../../../src/pans/mobile-pans-context";

export default function FieldRoute() {
  const livePosition = useFieldLivePosition();
  const anchorOverlay = useFieldAnchorOverlay();
  return (
    <FieldScreen
      livePosition={livePosition}
      anchors={anchorOverlay.anchors}
      anchorOverlayOptions={anchorOverlay.options}
    />
  );
}
