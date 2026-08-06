import React from "react";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import {
  useKnownPansAnchors,
  useRememberedPansTag,
} from "../../pans/mobile-pans-context";
import { cachedAnchorGeometry } from "../../pans/pans-anchor-cache";
import { fieldAnchorOverlayOptions } from "./field-anchor-overlay-options";

export function useFieldAnchorOverlay() {
  const { settings } = useAppSettingsSnapshot();
  const rememberedTag = useRememberedPansTag();
  const knownAnchors = useKnownPansAnchors();
  const anchors = React.useMemo(
    () => cachedAnchorGeometry(rememberedTag, knownAnchors),
    [knownAnchors, rememberedTag],
  );
  const options = React.useMemo(
    () => fieldAnchorOverlayOptions(settings),
    [settings],
  );
  return { anchors, options } as const;
}
