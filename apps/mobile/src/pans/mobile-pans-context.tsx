import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type { FieldPoint, FusedPositionOutput } from "@eight2five/mobile/field";
import {
  createExpoDeviceMotionAdapter,
  type DeviceMotionAdapter,
} from "@eight2five/mobile/motion";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { MobilePansStore, type MobilePansSnapshot } from "./mobile-pans-store";

interface MobilePansContextValue {
  readonly store: MobilePansStore;
  readonly positionValue: SharedValue<FieldPoint | null>;
  readonly fusionValue: SharedValue<FusedPositionOutput | null>;
}

const MobilePansContext = React.createContext<MobilePansContextValue | null>(
  null,
);

export function MobilePansProvider({
  children,
  store: injectedStore,
  motionAdapter,
  motionInterpolationEnabled,
  developerModeEnabled,
  appState = AppState,
}: {
  readonly children: React.ReactNode;
  readonly store?: MobilePansStore;
  readonly motionAdapter?: DeviceMotionAdapter;
  readonly motionInterpolationEnabled?: boolean;
  readonly developerModeEnabled?: boolean;
  readonly appState?: {
    readonly currentState: AppStateStatus | null;
    addEventListener(
      type: "change",
      listener: (state: AppStateStatus) => void,
    ): { remove(): void };
  };
}) {
  const [ownedStore] = React.useState(
    () =>
      new MobilePansStore({
        motionAdapter: motionAdapter ?? createExpoDeviceMotionAdapter(),
        motionInterpolationEnabled: motionInterpolationEnabled ?? false,
        developerModeEnabled: developerModeEnabled ?? false,
      }),
  );
  const store = injectedStore ?? ownedStore;
  const positionValue = useSharedValue<FieldPoint | null>(null);
  const fusionValue = useSharedValue<FusedPositionOutput | null>(null);

  React.useEffect(() => {
    if (motionInterpolationEnabled !== undefined) {
      store.setMotionInterpolationEnabled(motionInterpolationEnabled);
    }
  }, [motionInterpolationEnabled, store]);

  React.useEffect(() => {
    if (developerModeEnabled !== undefined) {
      void store.setDeveloperModeEnabled(developerModeEnabled);
    }
  }, [developerModeEnabled, store]);

  React.useEffect(() => {
    store.attachPositionValue(positionValue);
    store.attachFusionValue(fusionValue);
    store.setForeground(appState.currentState === "active");
    void store.initialize();
    const subscription = appState.addEventListener("change", (state) => {
      store.setForeground(state === "active");
    });
    return () => {
      subscription.remove();
      void store.dispose();
    };
  }, [appState, fusionValue, positionValue, store]);

  const value = React.useMemo(
    () => ({ store, positionValue, fusionValue }),
    [fusionValue, positionValue, store],
  );
  return (
    <MobilePansContext.Provider value={value}>
      {children}
    </MobilePansContext.Provider>
  );
}

export function useMobilePansStore(): MobilePansStore {
  return useMobilePansContext().store;
}

export function useMobilePansSnapshot(): MobilePansSnapshot {
  const store = useMobilePansStore();
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export function useFieldLivePosition() {
  const context = useMobilePansContext();
  const livePosition = React.useSyncExternalStore(
    context.store.subscribe,
    () => context.store.getSnapshot().livePosition,
    () => context.store.getSnapshot().livePosition,
  );
  return React.useMemo(
    () => ({
      state: livePosition,
      positionValue: context.positionValue,
      fusionValue: context.fusionValue,
    }),
    [context.fusionValue, context.positionValue, livePosition],
  );
}

export function useRememberedPansTag(): ManagedDevice | undefined {
  const store = useMobilePansStore();
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().rememberedTag,
    () => store.getSnapshot().rememberedTag,
  );
}

export function useKnownPansAnchors(): readonly ManagedDevice[] {
  const store = useMobilePansStore();
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().knownAnchors,
    () => store.getSnapshot().knownAnchors,
  );
}

function useMobilePansContext(): MobilePansContextValue {
  const context = React.useContext(MobilePansContext);
  if (!context) {
    throw new Error(
      "Mobile PANS hooks must be used inside MobilePansProvider.",
    );
  }
  return context;
}
