import React from "react";
import { Plus } from "lucide-react-native";
import {
  normalizeTransportDeviceId,
  selectNetworkDeviceSections,
  type DisplayDevice,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { NetworkDeviceHierarchy } from "./network-device-hierarchy";
import { NetworkProfileDialog } from "./network-profile-dialog";
import { PansDeviceDialog } from "./pans-device-dialog";
import { SettingsMessage } from "./settings-components";

export function NetworkDeviceManager({
  initialNetworkId,
  onConnectTag,
  onEditAnchorPosition,
}: {
  readonly initialNetworkId?: string;
  readonly onConnectTag?: (transportDeviceId: string) => Promise<void>;
  readonly onEditAnchorPosition: (anchorId: string) => void;
}) {
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const [selectedNetworkId, setSelectedNetworkId] = React.useState<
    string | undefined
  >(initialNetworkId);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>();
  const [createNetworkOpen, setCreateNetworkOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const sections = React.useMemo(
    () =>
      selectNetworkDeviceSections(
        snapshot.networks,
        snapshot.managedDevices,
        snapshot.discoveries,
      ),
    [snapshot.discoveries, snapshot.managedDevices, snapshot.networks],
  );
  const selectedNetwork = snapshot.networks.find(
    (network) => network.id === selectedNetworkId,
  );
  const selectedDevice = snapshot.managedDevices.find(
    (device) => device.id === selectedDeviceId,
  );
  const selectedDiscovery = selectedDevice
    ? snapshot.discoveries.find(
        (discovery) =>
          normalizeTransportDeviceId(discovery.transportDeviceId) ===
          normalizeTransportDeviceId(selectedDevice.transportDeviceId),
      )
    : undefined;

  const run = React.useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setBusy(false);
    }
  }, []);

  const openDevice = React.useCallback(
    async (display: DisplayDevice) => {
      if (!display.savedDevice && !display.discovery) return;
      await run(async () => {
        let saved = display.savedDevice;
        if (!saved) {
          const discovery = display.discovery!;
          saved =
            discovery.presence?.role === "anchor"
              ? await store.persistDiscoveredAnchor(discovery.transportDeviceId)
              : await store.persistDiscoveredDevice(
                  discovery.transportDeviceId,
                );
        }
        if (display.available && !saved.lastKnownConfig) {
          saved = await store.inspectDevice(saved.id);
        }
        setSelectedDeviceId(saved.id);
      });
    },
    [run, store],
  );

  const connectTag = React.useCallback(
    (display: DisplayDevice) => {
      if (!onConnectTag) return;
      void run(() => onConnectTag(display.transportDeviceId));
    },
    [onConnectTag, run],
  );

  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}
      <Button
        variant="outline"
        testID="create-network-profile-button"
        isDisabled={busy}
        onPress={() => setCreateNetworkOpen(true)}
      >
        <ButtonIcon as={Plus} />
        <ButtonText>Create Network</ButtonText>
      </Button>

      <NetworkDeviceHierarchy
        sections={sections}
        busy={busy}
        onOpenNetwork={setSelectedNetworkId}
        onOpenDevice={(device) => void openDevice(device)}
        onConnectTag={onConnectTag ? connectTag : undefined}
      />

      {createNetworkOpen || selectedNetwork ? (
        <NetworkProfileDialog
          key={selectedNetwork?.id ?? "create-network"}
          networks={snapshot.networks}
          isOpen
          network={selectedNetwork}
          onClose={() => {
            setCreateNetworkOpen(false);
            setSelectedNetworkId(undefined);
          }}
          onCreate={async (name, panId) => {
            await store.createNetwork(name, panId);
          }}
          onUpdate={async (networkId, changes) => {
            await store.updateNetwork(networkId, changes);
          }}
          onDelete={async (networkId) => {
            await store.deleteNetwork(networkId);
          }}
        />
      ) : null}

      {selectedDevice ? (
        <PansDeviceDialog
          key={selectedDevice.id}
          device={selectedDevice}
          discovery={selectedDiscovery}
          networks={snapshot.networks}
          isOpen
          onClose={() => setSelectedDeviceId(undefined)}
          onRename={async (deviceId, label) => {
            await store.renameDevice(deviceId, label);
          }}
          onAssignNetwork={async (deviceId, networkId) => {
            await store.assignDeviceToNetwork(deviceId, networkId);
          }}
          onConvertToAnchor={async (transportDeviceId, targetNetworkId) => {
            const saved = await store.persistDiscoveredAnchor(
              transportDeviceId,
              true,
              targetNetworkId,
            );
            setSelectedDeviceId(saved.id);
          }}
          onConvertToPerformerTag={async (deviceId) => {
            const saved = await store.convertDeviceToPerformerTag(deviceId);
            setSelectedDeviceId(saved.id);
          }}
          onSetInitiator={async (networkId, anchorId) => {
            await store.setNetworkInitiator(networkId, anchorId);
          }}
          onEditAnchorPosition={(anchorId) => {
            setSelectedDeviceId(undefined);
            onEditAnchorPosition(anchorId);
          }}
        />
      ) : null}
    </VStack>
  );
}
