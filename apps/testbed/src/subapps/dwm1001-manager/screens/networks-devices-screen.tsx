import React from "react";
import { useRouter } from "expo-router";
import {
  selectNetworkDeviceSections,
  type DisplayDevice,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { HStack } from "@eight2five/ui/components/hstack";
import { SafeAreaView } from "@eight2five/ui/components/safe-area-view";
import { Spinner } from "@eight2five/ui/components/spinner";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { RadioTower, Square } from "lucide-react-native";

import { NetworkDeviceSection } from "../components/network-device-section";
import { usePansManager } from "../manager-context";

export function NetworksDevicesScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const sections = React.useMemo(
    () =>
      selectNetworkDeviceSections(
        manager.networks,
        manager.devices,
        manager.discoveries,
      ),
    [manager.networks, manager.devices, manager.discoveries],
  );
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(["unassigned"]),
  );
  const [expandedDevices, setExpandedDevices] = React.useState<Set<string>>(
    () => new Set(),
  );
  const hasDeviceRows = sections.some((section) => section.devices.length > 0);
  const emptyMessage =
    manager.initialization === "ready" && !hasDeviceRows
      ? manager.isScanning
        ? "Scanning…"
        : "No devices"
      : undefined;

  const setSectionExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedSections((current) =>
        updateExpandedSet(current, key, expanded),
      );
    },
    [],
  );
  const setDeviceExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedDevices((current) =>
        updateExpandedSet(current, key, expanded),
      );
    },
    [],
  );

  const openDeviceSettings = React.useCallback(
    async (device: DisplayDevice) => {
      const saved =
        device.savedDevice ??
        (device.discovery
          ? await manager.persistDiscovery(device.discovery)
          : undefined);
      if (!saved) throw new Error("Device discovery is unavailable.");
      router.push(
        `/(subapps)/dwm1001-manager/devices/${saved.id}/edit` as never,
      );
    },
    [manager, router],
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <VStack className="flex-1">
        <HStack
          testID="network-devices-actions"
          className="w-full min-h-14 items-center justify-end"
          style={{ paddingHorizontal: eight2FiveSpacing.md }}
        >
          {manager.initialization === "initializing" ? (
            <HStack
              accessible
              accessibilityLabel="Native Module Loading"
              accessibilityState={{ busy: true, disabled: true }}
              pointerEvents="none"
              className="items-center"
              style={{ gap: eight2FiveSpacing.sm }}
            >
              <Spinner color={theme.textMuted} />
              <Text style={{ color: theme.textMuted }}>
                Native Module Loading
              </Text>
            </HStack>
          ) : manager.initialization === "ready" ? (
            <Button
              testID="scan-control"
              size="sm"
              accessibilityLabel={
                manager.isScanning ? "Stop device scan" : "Start device scan"
              }
              accessibilityState={{ selected: manager.isScanning }}
              onPress={() => {
                if (manager.isScanning) manager.stopDiscovery();
                else void manager.startDiscovery();
              }}
            >
              <ButtonIcon as={manager.isScanning ? Square : RadioTower} />
              <ButtonText>{manager.isScanning ? "Stop" : "Scan"}</ButtonText>
            </Button>
          ) : null}
        </HStack>

        {manager.initializationError ? (
          <InlineError
            testID="initialization-error"
            message={manager.initializationError}
            onRetry={manager.retryInitialization}
          />
        ) : null}
        {manager.discoveryError ? (
          <InlineError
            testID="discovery-error"
            message={manager.discoveryError}
          />
        ) : null}

        <FlatList
          testID="network-device-sections"
          data={sections}
          keyExtractor={(section) => section.key}
          extraData={`${Array.from(expandedSections)
            .sort()
            .join("|")}::${Array.from(expandedDevices).sort().join("|")}::${
            emptyMessage ?? ""
          }`}
          contentContainerStyle={{
            paddingHorizontal: eight2FiveSpacing.md,
            paddingBottom: eight2FiveSpacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <NetworkDeviceSection
              section={item}
              expanded={expandedSections.has(item.key)}
              onExpandedChange={(expanded) =>
                setSectionExpanded(item.key, expanded)
              }
              expandedDeviceKeys={expandedDevices}
              onDeviceExpandedChange={setDeviceExpanded}
              snapshots={manager.deviceSnapshots}
              emptyMessage={
                item.type === "unassigned" ? emptyMessage : undefined
              }
              onEditNetwork={(networkId) =>
                router.push(
                  `/(subapps)/dwm1001-manager/networks/${networkId}/settings` as never,
                )
              }
              onOpenDeviceSettings={openDeviceSettings}
              onRefreshDevice={manager.inspectDevice}
            />
          )}
        />
      </VStack>
    </SafeAreaView>
  );
}

function InlineError({
  message,
  testID,
  onRetry,
}: {
  message: string;
  testID: string;
  onRetry?: () => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      testID={testID}
      className="items-center justify-between"
      style={{
        gap: eight2FiveSpacing.sm,
        paddingHorizontal: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.sm,
      }}
    >
      <Text
        selectable
        size="sm"
        accessibilityRole="alert"
        className="flex-1"
        style={{ color: theme.danger }}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button
          testID="retry-initialization"
          size="sm"
          variant="ghost"
          accessibilityLabel="Retry manager initialization"
          onPress={onRetry}
        >
          <ButtonText style={{ color: theme.text }}>Retry</ButtonText>
        </Button>
      ) : null}
    </HStack>
  );
}

function updateExpandedSet(
  current: ReadonlySet<string>,
  key: string,
  expanded: boolean,
): Set<string> {
  if (expanded === current.has(key)) return current as Set<string>;
  const next = new Set(current);
  if (expanded) next.add(key);
  else next.delete(key);
  return next;
}
