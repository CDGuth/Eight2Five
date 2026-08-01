import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type { FieldPoint } from "@eight2five/mobile/field";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { MobilePansStore, type MobilePansSnapshot } from "./mobile-pans-store";

interface MobilePansContextValue {
  readonly store: MobilePansStore;
  readonly positionValue: SharedValue<FieldPoint | null>;
}

const MobilePansContext = React.createContext<MobilePansContextValue | null>(
  null,
);

export function MobilePansProvider({
  children,
  store: injectedStore,
  appState = AppState,
}: {
  readonly children: React.ReactNode;
  readonly store?: MobilePansStore;
  readonly appState?: {
    readonly currentState: AppStateStatus | null;
    addEventListener(
      type: "change",
      listener: (state: AppStateStatus) => void,
    ): { remove(): void };
  };
}) {
  const [ownedStore] = React.useState(() => new MobilePansStore());
  const store = injectedStore ?? ownedStore;
  const positionValue = useSharedValue<FieldPoint | null>(null);

  React.useEffect(() => {
    store.attachPositionValue(positionValue);
    store.setForeground(appState.currentState === "active");
    void store.initialize();
    const subscription = appState.addEventListener("change", (state) => {
      store.setForeground(state === "active");
    });
    return () => {
      subscription.remove();
      void store.dispose();
    };
  }, [appState, positionValue, store]);

  const value = React.useMemo(
    () => ({ store, positionValue }),
    [positionValue, store],
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
    }),
    [context.positionValue, livePosition],
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
