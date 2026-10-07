import React from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import { NetworkDeviceManager } from "./network-device-manager";
import { ownTagDiscoveryWhileFocused } from "./tag-connection-lifecycle";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
} from "./settings-components";

/** Compatibility route that opens the selected profile in Networks & Devices. */
export function NetworkDetailScreen({
  networkId,
}: {
  readonly networkId: string;
}) {
  const router = useRouter();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const { settings } = useAppSettingsSnapshot();
  const [lifecycleError, setLifecycleError] = React.useState<Error>();
  const network = snapshot.networks.find((item) => item.id === networkId);

  useFocusEffect(
    React.useCallback(() => {
      if (!settings.developerModeEnabled) return;
      return ownTagDiscoveryWhileFocused(
        store,
        snapshot.initialization === "ready",
        store.getSnapshot().connectionState === "connected",
        setLifecycleError,
      );
    }, [settings.developerModeEnabled, snapshot.initialization, store]),
  );

  if (!settings.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">
          Enable Developer Mode before managing PANS networks and devices.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  if (snapshot.initialization === "ready" && networkId && !network) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="error">
          The selected network profile no longer exists.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  return (
    <SettingsScreenContainer>
      {snapshot.error || lifecycleError ? (
        <SettingsMessage tone="error">
          {(lifecycleError ?? snapshot.error)?.message}
        </SettingsMessage>
      ) : null}
      <SettingsSection title="Networks & Devices">
        <VStack style={{ padding: eight2FiveSpacing.md }}>
          <NetworkDeviceManager
            initialNetworkId={networkId}
            onConnectTag={(transportDeviceId) =>
              store.selectConfigureAndConnectTag(transportDeviceId)
            }
            onEditAnchorPosition={(anchorId) =>
              router.push(`/(tabs)/settings/anchor/${anchorId}` as never)
            }
          />
        </VStack>
      </SettingsSection>
    </SettingsScreenContainer>
  );
}
