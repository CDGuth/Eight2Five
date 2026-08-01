import React from "react";
import { useFocusEffect } from "expo-router";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";

export function useAnchorListController() {
  const { settings } = useAppSettingsSnapshot();
  const pans = useMobilePansSnapshot();
  const store = useMobilePansStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshingRef = React.useRef(false);
  const [error, setError] = React.useState<Error>();

  const refresh = React.useCallback(async () => {
    if (pans.initialization !== "ready" || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError(undefined);
    try {
      await store.refreshCachedAnchors();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [pans.initialization, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return {
    developerModeEnabled: settings.developerModeEnabled,
    anchors: pans.knownAnchors,
    refreshing,
    error: error ?? pans.error,
    refresh,
  } as const;
}
