import React from "react";
import { usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

import { getMobileOrientationLock } from "./mobile-orientation";

/** Keeps every route portrait-only except Field, which may rotate freely. */
export function useMobileOrientationLock(): void {
  const pathname = usePathname();

  React.useEffect(() => {
    void ScreenOrientation.lockAsync(getMobileOrientationLock(pathname));
  }, [pathname]);
}
