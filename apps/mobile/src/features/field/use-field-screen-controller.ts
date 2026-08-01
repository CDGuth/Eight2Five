import React from "react";
import { useWindowDimensions } from "react-native";
import type { FieldViewport } from "@eight2five/mobile/field";

import { useFieldOrientation } from "../../navigation/use-field-orientation";

let committedFieldViewport: FieldViewport | undefined;

/**
 * Owns viewport commits outside the renderer. The module-level session value is
 * deliberate: native-tab presentation changes may remount the route, but they
 * must not reset the performer's field center or zoom.
 */
export function useFieldScreenController() {
  const orientation = useFieldOrientation();
  const { width, height } = useWindowDimensions();
  const [initialViewport] = React.useState(() => committedFieldViewport);
  const commitViewport = React.useCallback((viewport: FieldViewport) => {
    committedFieldViewport = viewport;
  }, []);

  return {
    width,
    height,
    landscape: orientation.landscape,
    defaultViewport: initialViewport,
    commitViewport,
  } as const;
}

export function resetFieldViewportSessionForTests(): void {
  committedFieldViewport = undefined;
}
