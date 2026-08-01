import React from "react";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import { useMobilePansSnapshot } from "../../pans/mobile-pans-context";
import { cachedAnchorGeometry } from "../../pans/pans-anchor-cache";
import { fieldAnchorOverlayOptions } from "./field-anchor-overlay-options";

export function useFieldAnchorOverlay() {
  const { settings } = useAppSettingsSnapshot();
  const pans = useMobilePansSnapshot();
  const anchors = React.useMemo(
    () => cachedAnchorGeometry(pans.rememberedTag, pans.knownAnchors),
    [pans.knownAnchors, pans.rememberedTag],
  );
  const options = React.useMemo(
    () => fieldAnchorOverlayOptions(settings),
    [settings],
  );
  return { anchors, options } as const;
}
